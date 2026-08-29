/*
 * WebMCP — PrepWise as a set of tools an AI agent can call.
 *
 * The point of this file is the one thing a local-only app could not otherwise
 * have. A conventional MCP server cannot see this pantry: the data is in
 * localStorage, in the user's browser, and no server process is ever going to
 * reach it. WebMCP inverts that — the tool handlers run *in the page*, where
 * `state` already is. Registration is a local JS call, so nothing is fetched
 * and `connect-src 'none'` is untouched.
 *
 * The headline is prepwise_propose_inventory_items: photograph a fridge, let
 * the agent read it, and have the pantry filled in. PrepWise needs no camera,
 * no image parsing and no network to do it — only a way to accept structured
 * items, which Quick Entry already established.
 *
 * THE RULE THIS FILE IS BUILT AROUND
 * ----------------------------------
 * Reads may be answered. Writes are staged, never applied. A model can
 * hallucinate twelve eggs from a photograph of six, or repeat an instruction
 * printed on a label. So anything that would change the pantry is routed
 * through validateBackup() -> sanitizeBackup() -> the ordinary import preview,
 * and the tool reports that it is *awaiting confirmation* — never that it
 * succeeded. This is the same treatment a hostile file gets, for the same
 * reason.
 *
 * There are deliberately no "transact" tools. Clearing the pantry is not
 * something an agent gets to attempt, at any confidence level.
 *
 * SPEC CHURN
 * ----------
 * WebMCP is a W3C Community Group draft, not on the Standards Track, with the
 * API still moving. Everything specific to it is contained here, and every
 * assumption about *where* the API lives is contained in resolveModelContext().
 * When the spec moves, that function is the blast radius. Deleting this file
 * and the Settings block removes the feature; nothing else depends on it.
 *
 * Docs: docs/webmcp-plan.md
 */

(function () {
    'use strict';

    // Names must be 1-128 chars of ASCII alphanumerics, underscore, hyphen or
    // period. Prefixed so a model with several tabs open can tell whose pantry
    // it is looking at.
    const PREFIX = 'prepwise_';

    // A pantry is not a context window. Every result is capped.
    const MAX_OUTPUT = 1500;

    // Bounds on what an agent may propose in one call. sanitizeBackup() caps
    // again on its own terms; these exist so an absurd call is refused with an
    // explanation rather than silently trimmed.
    const MAX_PROPOSED_ITEMS = 100;
    const MAX_PROPOSED_RECIPES = 20;

    /*
     * Enumerated in the schema so the model is handed the vocabulary rather
     * than left to invent "grammes". Copied rather than referenced because the
     * schema is built when this file evaluates; `tests/webmcp.spec.js` asserts
     * it still matches UNITS in app.js, which is what stops the two drifting.
     */
    const AGENT_UNITS = ['units', 'oz', 'lb', 'g', 'kg', 'cups', 'tbsp', 'tsp'];

    /*
     * Whether this browser offers PrepWise to agents. Deliberately NOT in
     * STORAGE_KEYS: like the theme and running timers, it describes the device,
     * not the pantry, so it is neither exported nor imported. The kitchen
     * tablet may talk to an agent while the laptop does not.
     */
    const SETTINGS_KEY = 'prepwise-agent-settings';

    /**
     * The only place that knows where the API lives.
     *
     * The spec settled on document.modelContext; earlier drafts and some
     * write-ups say navigator.modelContext. Both are checked because being
     * wrong here costs a feature detect, while guessing wrong costs the
     * feature. Returns null when unsupported, which is the normal case today
     * and must stay completely silent.
     */
    function resolveModelContext() {
        try {
            const context = (typeof document !== 'undefined' && document.modelContext)
                || (typeof navigator !== 'undefined' && navigator.modelContext)
                || null;
            return context && typeof context.registerTool === 'function' ? context : null;
        } catch (error) {
            return null;
        }
    }

    // ---------------------------------------------------------------------
    // Result shaping
    // ---------------------------------------------------------------------

    function truncate(value) {
        const body = String(value);
        return body.length <= MAX_OUTPUT
            ? body
            : body.slice(0, MAX_OUTPUT) + '\n… (truncated; ask for a narrower slice)';
    }

    function reply(body) {
        return { content: [{ type: 'text', text: truncate(body) }] };
    }

    function failure(body) {
        return { isError: true, content: [{ type: 'text', text: truncate(body) }] };
    }

    /*
     * One proposal at a time.
     *
     * stageImport() replaces whatever is pending, so a second proposal while
     * the first preview is still open would swap the contents out from under
     * it — the user would be looking at one list and confirming another. Refuse
     * instead, and say why, so the agent waits rather than retrying.
     */
    function proposalPending() {
        const modal = document.getElementById('import-modal');
        return !!modal && !modal.classList.contains('hidden');
    }

    const BUSY = 'A proposal is already on screen waiting for the user to accept or '
        + 'dismiss it. Wait for them to deal with that one before sending another.';

    /*
     * "1 of them are already in the pantry" is the sort of thing an agent reads
     * out to a person verbatim, so it has to be a sentence. Handles the three
     * cases that read badly otherwise: none skipped, some skipped, all skipped.
     */
    function describeSkips(skipped, total, where) {
        if (!skipped) return '';
        if (skipped === total) {
            return total === 1
                ? `It is ${where} already, so it would be skipped.`
                : `All of them are ${where} already, so they would be skipped.`;
        }
        return skipped === 1
            ? `One of them is ${where} already and would be skipped.`
            : `${skipped} of them are ${where} already and would be skipped.`;
    }

    // ---------------------------------------------------------------------
    // Reading the pantry
    // ---------------------------------------------------------------------

    /*
     * `state` is a top-level `let` in app.js, so it lives in the global lexical
     * scope rather than on `window` — reachable as a bare identifier from this
     * script because both are classic scripts and app.js is loaded first.
     */
    function inventory() {
        return Array.isArray(state.inventory) ? state.inventory : [];
    }

    function recipes() {
        return Array.isArray(state.recipes) ? state.recipes : [];
    }

    /*
     * Expiration status is derived, and the stored copy is a snapshot. Refresh
     * before answering or a tool can contradict the screen next to it.
     */
    function freshen() {
        if (typeof refreshExpirationStatuses === 'function') refreshExpirationStatuses();
    }

    /** Seconds as a clock, so a step timer reads as a duration. */
    function clockOf(seconds) {
        const total = Math.max(0, Math.round(Number(seconds) || 0));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const rest = total % 60;
        const pad = value => String(value).padStart(2, '0');
        return hours
            ? `${hours}:${pad(minutes)}:${pad(rest)}`
            : `${minutes}:${pad(rest)}`;
    }

    function describeItem(item) {
        const status = typeof formatExpiryForAI === 'function'
            ? formatExpiryForAI(item)
            : (item.expirationDate || 'not tracked');
        return `- ${item.name}: ${item.current} of ${item.max} ${item.unit} (${status})`;
    }

    /** "Prep: 10 min · Cook: 30 min · Serves: 4", omitting whatever is blank. */
    function describeRecipeMeta(recipe) {
        if (typeof formatRecipeMeta !== 'function') return '';
        return [
            recipe.prepTime ? `Prep: ${formatRecipeMeta(recipe.prepTime, 'min')}` : '',
            recipe.cookTime ? `Cook: ${formatRecipeMeta(recipe.cookTime, 'min')}` : '',
            recipe.servings ? `Serves: ${formatRecipeMeta(recipe.servings, 'servings')}` : ''
        ].filter(Boolean).join(' · ');
    }

    /*
     * A step's text lives in `content` — `text` is not a field, and reading it
     * once returned a recipe whose every step was blank. Paragraphs are notes
     * rather than instructions, so they are not numbered, exactly as the
     * recipe modal renders them.
     */
    function describeMethod(steps) {
        let number = 0;
        return steps.map(entry => {
            const step = typeof entry === 'string' ? { content: entry } : (entry || {});
            const body = step.content || '';
            const timer = step.timerSeconds ? ` [timer: ${clockOf(step.timerSeconds)}]` : '';
            if (step.type === 'paragraph') return `${body}${timer}`;
            number += 1;
            return `${number}. ${body}${timer}`;
        });
    }

    /** Find one recipe by name/partial name, or null. */
    function findRecipe(wanted) {
        return recipes().find(r => String(r.name).toLowerCase().includes(wanted)) || null;
    }

    /*
     * Say what *is* here. Watching a real agent, a bare "no match" cost it an
     * extra round trip to list_recipes before it could answer; naming the
     * cookbook's contents lets it correct itself from this one reply.
     */
    function recipeNotFound(wanted) {
        const names = recipes().map(r => r.name).slice(0, 40);
        return failure(names.length
            ? `No recipe matches "${wanted}". The cookbook has: ${names.join(', ')}.`
            : `No recipe matches "${wanted}" — there are no recipes saved yet.`);
    }

    // ---------------------------------------------------------------------
    // Tool definitions
    // ---------------------------------------------------------------------

    /*
     * untrustedContentHint is true on everything that echoes stored data.
     * Pantry and recipe names are typed by users and can arrive from an
     * imported file — the same input the sanitizer exists to distrust. The
     * flag tells the host model to read the output as data, not instructions.
     */
    const TOOLS = [
        {
            name: PREFIX + 'get_pantry_summary',
            description:
                'Summarise the current state of the kitchen: how full the pantry is, how many '
                + 'items are low, expiring or expired, and how many recipes can be cooked right now.',
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            inputSchema: { type: 'object', properties: {} },
            execute() {
                freshen();
                const items = inventory();
                const all = recipes();
                const makeable = typeof canMakeRecipe === 'function'
                    ? all.filter(canMakeRecipe).length
                    : 0;
                const expired = items.filter(i => i.expirationStatus === 'expired').length;
                const soon = items.filter(i =>
                    i.expirationStatus === 'expiringSoon' || i.expirationStatus === 'expiringToday').length;
                const low = typeof getLowStockItems === 'function' ? getLowStockItems().length : 0;

                if (!items.length && !all.length) {
                    return reply('The pantry and recipe book are both empty. Nothing has been added yet.');
                }

                // The description promises "how full the pantry is", so say it.
                // This is the same figure the Overview prints.
                const fill = typeof getOverallInventoryPercentage === 'function'
                    ? getOverallInventoryPercentage()
                    : null;

                return reply([
                    `Pantry: ${items.length} item${items.length === 1 ? '' : 's'}`
                        + (fill === null ? '.' : `, ${fill}% stocked overall.`),
                    `Low stock: ${low}. Expiring soon: ${soon}. Expired: ${expired}.`,
                    `Recipes: ${all.length}, of which ${makeable} can be cooked with what is in stock.`
                ].join('\n'));
            }
        },

        {
            name: PREFIX + 'get_shopping_list',
            description:
                'List what needs buying: items running low, plus replacements for anything that '
                + 'has expired. Answers questions like "how many things are on my shopping list?".',
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            inputSchema: { type: 'object', properties: {} },
            execute() {
                freshen();
                if (typeof buildShoppingListText !== 'function') {
                    return failure('The shopping list is unavailable.');
                }
                const count = typeof generateEnhancedShoppingList === 'function'
                    ? generateEnhancedShoppingList().length
                    : 0;
                return reply(`${count} item${count === 1 ? '' : 's'} to buy.\n\n${buildShoppingListText()}`);
            }
        },

        {
            name: PREFIX + 'list_inventory',
            description:
                'List what is in the pantry, with quantities and expiration status. '
                + 'Use the filter to narrow to items that are low, expiring, or already expired.',
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            inputSchema: {
                type: 'object',
                properties: {
                    filter: {
                        type: 'string',
                        enum: ['all', 'low', 'expiring', 'expired'],
                        description: 'Which items to return. Defaults to all.'
                    },
                    limit: {
                        type: 'number',
                        description: 'Maximum number of items to return (1-100).'
                    }
                }
            },
            execute(args) {
                freshen();
                const filter = (args && args.filter) || 'all';
                const limit = Math.min(Math.max(Number(args && args.limit) || 50, 1), 100);

                let items = inventory();
                if (filter === 'expired') {
                    items = items.filter(i => i.expirationStatus === 'expired');
                } else if (filter === 'expiring') {
                    items = items.filter(i =>
                        i.expirationStatus === 'expiringSoon' || i.expirationStatus === 'expiringToday');
                } else if (filter === 'low') {
                    items = typeof getLowStockItems === 'function' ? getLowStockItems() : [];
                }

                if (!items.length) return reply(`Nothing matches the filter "${filter}".`);

                const shown = items.slice(0, limit);
                const header = shown.length < items.length
                    ? `${items.length} items match "${filter}"; showing the first ${shown.length}.`
                    : `${items.length} item${items.length === 1 ? '' : 's'} matching "${filter}".`;
                return reply([header, ''].concat(shown.map(describeItem)).join('\n'));
            }
        },

        {
            name: PREFIX + 'list_recipes',
            description:
                'List saved recipes with how many each serves, and whether each can be cooked '
                + 'with what is currently in the pantry, including which ingredients are missing. '
                + 'Use this to answer "what can I cook" or "does anything feed six".',
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            inputSchema: {
                type: 'object',
                properties: {
                    filter: {
                        type: 'string',
                        enum: ['all', 'can-make', 'missing'],
                        description: 'Which recipes to return. Defaults to all.'
                    }
                }
            },
            execute(args) {
                freshen();
                const filter = (args && args.filter) || 'all';
                const canMake = typeof canMakeRecipe === 'function' ? canMakeRecipe : () => false;

                let list = recipes();
                if (filter === 'can-make') list = list.filter(canMake);
                else if (filter === 'missing') list = list.filter(r => !canMake(r));

                if (!list.length) return reply(`No recipes match "${filter}".`);

                const lines = list.map(recipe => {
                    // Without this an agent asked "does anything feed eight?"
                    // had to fetch every recipe in full, and still guessed.
                    const serves = recipe.servings ? ` (serves ${recipe.servings})` : '';
                    if (canMake(recipe)) return `- ${recipe.name}${serves}: can make now`;
                    const missing = typeof getMissingIngredients === 'function'
                        ? getMissingIngredients(recipe).map(m => m.item)
                        : [];
                    return `- ${recipe.name}${serves}: missing ${missing.join(', ') || 'ingredients'}`;
                });
                return reply([`${list.length} recipe${list.length === 1 ? '' : 's'}:`, ''].concat(lines).join('\n'));
            }
        },

        {
            name: PREFIX + 'get_recipe',
            description:
                'Get one recipe in full: prep and cook times, how many it serves, its '
                + 'ingredients with amounts, and its numbered method with any step timers.',
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            inputSchema: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'The recipe name, or part of it.' }
                },
                required: ['name']
            },
            execute(args) {
                const wanted = String((args && args.name) || '').trim().toLowerCase();
                if (!wanted) return failure('A recipe name is required.');

                const recipe = findRecipe(wanted);
                if (!recipe) return recipeNotFound(wanted);

                // Never touch .ingredients / .steps directly: a record from an
                // older build or a file may not have them.
                const ings = typeof recipeIngredients === 'function' ? recipeIngredients(recipe) : [];
                const steps = typeof recipeSteps === 'function' ? recipeSteps(recipe) : [];
                const meta = describeRecipeMeta(recipe);
                const method = describeMethod(steps);

                return reply([
                    recipe.name,
                    meta,
                    '',
                    'Ingredients:',
                    ...ings.map(i => `- ${i.amount} ${i.unit} ${i.item}`),
                    '',
                    'Method:',
                    ...method
                ].filter((line, i) => line !== '' || i > 1).join('\n'));
            }
        },

        {
            name: PREFIX + 'get_expiring_items',
            description:
                'List pantry items that are expiring soon or today, or have already expired, '
                + 'sorted with the most urgent first. Use this to answer "what is going to expire '
                + 'soon" or "what should I use up first".',
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            inputSchema: {
                type: 'object',
                properties: {
                    includeExpired: {
                        type: 'boolean',
                        description: 'Include items that have already expired. Defaults to true.'
                    },
                    limit: {
                        type: 'number',
                        description: 'Maximum number of items to return (1-100). Defaults to 20.'
                    }
                }
            },
            execute(args) {
                freshen();
                const includeExpired = !(args && args.includeExpired === false);
                const limit = Math.min(Math.max(Number(args && args.limit) || 20, 1), 100);

                const items = inventory().filter(i => i.hasExpiration && (
                    i.expirationStatus === 'expiringSoon'
                    || i.expirationStatus === 'expiringToday'
                    || (includeExpired && i.expirationStatus === 'expired')
                )).sort((a, b) => (a.daysUntilExpiry ?? 0) - (b.daysUntilExpiry ?? 0));

                if (!items.length) {
                    return reply(includeExpired
                        ? 'Nothing is expiring soon, and nothing has expired.'
                        : 'Nothing is expiring soon.');
                }

                const shown = items.slice(0, limit);
                const header = shown.length < items.length
                    ? `${items.length} items need attention; showing the most urgent ${shown.length}.`
                    : `${items.length} item${items.length === 1 ? '' : 's'} need attention, soonest first.`;
                return reply([header, ''].concat(shown.map(describeItem)).join('\n'));
            }
        },

        {
            name: PREFIX + 'get_recipe_gaps',
            description:
                'For one recipe, list exactly which ingredients are missing, insufficient, or '
                + 'spoiled in the pantry — with the amount still needed — plus what is currently '
                + 'in the pantry. PrepWise has no substitution database of its own; use this to '
                + 'ground a substitution suggestion in what is actually on hand, rather than '
                + 'guessing at what might be in the kitchen.',
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            inputSchema: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'The recipe name, or part of it.' }
                },
                required: ['name']
            },
            execute(args) {
                freshen();
                const wanted = String((args && args.name) || '').trim().toLowerCase();
                if (!wanted) return failure('A recipe name is required.');

                const recipe = findRecipe(wanted);
                if (!recipe) return recipeNotFound(wanted);

                const gaps = typeof getMissingIngredientsWithContext === 'function'
                    ? getMissingIngredientsWithContext(recipe)
                    : [];

                if (!gaps.length) {
                    return reply(`${recipe.name} has every ingredient in stock — nothing to substitute.`);
                }

                const lines = gaps.map(gap => {
                    if (gap.reason === 'not-in-inventory') {
                        return `- ${gap.item}: need ${gap.amount} ${gap.unit}, none in the pantry.`;
                    }
                    if (gap.reason === 'expired') {
                        const days = gap.daysExpired;
                        return `- ${gap.item}: need ${gap.amount} ${gap.unit}, what's in the pantry `
                            + `expired ${days} day${days === 1 ? '' : 's'} ago.`;
                    }
                    return `- ${gap.item}: need ${gap.needed} more ${gap.unit} `
                        + `(have ${gap.available} of ${gap.amount}).`;
                });

                // Full names only, not amounts — this is context for substitution
                // ideas, not a second inventory listing (that is list_inventory's job).
                const pantryNames = inventory().map(i => i.name);
                const shownNames = pantryNames.slice(0, 40);
                const pantryLine = pantryNames.length
                    ? `Currently in the pantry: ${shownNames.join(', ')}`
                        + (pantryNames.length > shownNames.length
                            ? `, and ${pantryNames.length - shownNames.length} more.` : '.')
                    : 'The pantry is currently empty.';

                return reply([`${recipe.name} is missing:`, ...lines, '', pantryLine].join('\n'));
            }
        },

        {
            name: PREFIX + 'get_meal_plan_candidates',
            description:
                'Rank saved recipes for planning a week of cooking: which can be made right now, '
                + 'which use up an ingredient that is expiring soon, and what is missing for the '
                + 'rest. PrepWise does not assemble the plan itself — use this to build one, '
                + 'prioritising recipes that use expiring ingredients before they are wasted.',
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            inputSchema: {
                type: 'object',
                properties: {
                    limit: {
                        type: 'number',
                        description: 'Maximum number of recipes to return (1-50). Defaults to 20.'
                    }
                }
            },
            execute(args) {
                freshen();
                const limit = Math.min(Math.max(Number(args && args.limit) || 20, 1), 50);
                const all = recipes();
                if (!all.length) return reply('There are no recipes saved yet to plan around.');

                const canMake = typeof canMakeRecipe === 'function' ? canMakeRecipe : () => false;
                const usesExpiring = typeof recipeUsesExpiringIngredients === 'function'
                    ? recipeUsesExpiringIngredients : () => false;
                const missingOf = typeof getMissingIngredients === 'function'
                    ? recipe => getMissingIngredients(recipe).map(m => m.item)
                    : () => [];

                const ranked = all.map(recipe => ({
                    recipe,
                    makeable: canMake(recipe),
                    expiring: usesExpiring(recipe),
                    missing: missingOf(recipe)
                })).sort((a, b) => {
                    // Recipes that rescue an expiring ingredient and can be
                    // cooked today sort first; those missing the most sort last.
                    const score = entry => (entry.expiring ? 2 : 0) + (entry.makeable ? 1 : 0);
                    return score(b) - score(a) || a.missing.length - b.missing.length;
                });

                const shown = ranked.slice(0, limit);
                const lines = shown.map(({ recipe, makeable, expiring, missing }) => {
                    const serves = recipe.servings ? ` (serves ${recipe.servings})` : '';
                    const tag = expiring ? ' [uses an expiring ingredient]' : '';
                    return makeable
                        ? `- ${recipe.name}${serves}: can make now${tag}`
                        : `- ${recipe.name}${serves}: missing ${missing.join(', ') || 'ingredients'}${tag}`;
                });

                const header = shown.length < ranked.length
                    ? `${ranked.length} recipes; showing the top ${shown.length} for planning.`
                    : `${ranked.length} recipe${ranked.length === 1 ? '' : 's'}, ranked for planning:`;
                return reply([header, ''].concat(lines).join('\n'));
            }
        },

        {
            name: PREFIX + 'get_recipe_timings',
            description:
                'Get prep/cook time, servings, and the full numbered method with any step '
                + 'timers for SEVERAL recipes at once. Use this to build a shared cooking '
                + 'timeline across recipes — for example sequencing them across a limited '
                + 'number of burners, one oven, an air fryer or a slow cooker. PrepWise does '
                + 'not know what appliances exist and does not schedule anything itself; it '
                + 'only supplies each recipe\'s timing so the scheduling can be worked out.',
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            inputSchema: {
                type: 'object',
                properties: {
                    names: {
                        type: 'array',
                        description: 'Recipe names, or parts of them, up to 10 at a time.',
                        maxItems: 10,
                        items: { type: 'string' }
                    }
                },
                required: ['names']
            },
            execute(args) {
                const wanted = args && Array.isArray(args.names) ? args.names : null;
                if (!wanted || !wanted.length) return failure('At least one recipe name is required.');
                if (wanted.length > 10) {
                    return failure(`That is ${wanted.length} recipes; 10 is the most that can be `
                        + 'looked up at once.');
                }

                const blocks = wanted.map(rawName => {
                    const name = String(rawName || '').trim().toLowerCase();
                    if (!name) return '(a blank recipe name was skipped)';

                    const recipe = findRecipe(name);
                    if (!recipe) return `"${rawName}": no matching recipe.`;

                    const steps = typeof recipeSteps === 'function' ? recipeSteps(recipe) : [];
                    const meta = describeRecipeMeta(recipe);
                    const method = describeMethod(steps);
                    return [`${recipe.name}${meta ? ' — ' + meta : ''}:`, ...method].join('\n');
                });

                return reply(blocks.join('\n\n'));
            }
        },

        {
            name: PREFIX + 'get_disruption_snapshot',
            description:
                'A full-kitchen snapshot for planning around a power outage or severe weather: '
                + 'every pantry item, the current shopping-list gaps, and which recipes can be '
                + 'made right now. PrepWise tracks no refrigeration, freezer, temperature or '
                + 'nutrition data, so it makes no claim here about what is still safe to eat, '
                + 'how quickly something will spoil, or whether a diet has a nutritional gap — '
                + 'apply your own general food-safety and nutrition knowledge to this data to '
                + 'make that call.',
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            inputSchema: {
                type: 'object',
                properties: {
                    scenario: {
                        type: 'string',
                        enum: ['power-outage', 'severe-weather'],
                        description: 'What is being planned for. Only changes the framing, not the data.'
                    },
                    limit: {
                        type: 'number',
                        description: 'Maximum pantry items to list (1-100). Defaults to 50.'
                    }
                }
            },
            execute(args) {
                freshen();
                const scenario = (args && args.scenario) || null;
                const limit = Math.min(Math.max(Number(args && args.limit) || 50, 1), 100);

                const framing = scenario === 'power-outage'
                    ? 'Planning for a power outage.'
                    : scenario === 'severe-weather'
                        ? 'Planning ahead of severe weather.'
                        : 'A full kitchen snapshot for planning around a disruption.';

                /*
                 * The safety disclaimer goes right after the framing, before
                 * anything that could be long enough to get truncated by
                 * MAX_OUTPUT. It must never be the part that gets cut off.
                 */
                const disclaimer = 'PrepWise tracks no refrigeration, freezer, temperature or '
                    + 'nutrition data — nothing below is a spoilage, safety or nutritional-gap '
                    + 'judgment. That reasoning is yours to apply to this data.';

                const items = inventory();
                const shownItems = items.slice(0, limit);
                const pantryBlock = items.length
                    ? [`Pantry (${items.length} item${items.length === 1 ? '' : 's'}`
                        + (shownItems.length < items.length ? `, showing ${shownItems.length}` : '') + '):', '']
                        .concat(shownItems.map(describeItem))
                    : ['The pantry is currently empty.'];

                const shoppingBlock = typeof buildShoppingListText === 'function'
                    ? ['', buildShoppingListText()]
                    : [];

                const canMake = typeof canMakeRecipe === 'function' ? canMakeRecipe : () => false;
                const makeable = recipes().filter(canMake).map(r => r.name);
                const recipeBlock = ['', makeable.length
                    ? `Can make right now: ${makeable.join(', ')}.`
                    : 'Nothing in the cookbook can be made from what is on hand right now.'];

                return reply([
                    framing, disclaimer, '',
                    ...pantryBlock, ...shoppingBlock, ...recipeBlock
                ].join('\n'));
            }
        },

        {
            name: PREFIX + 'check_recipe_against_allergies',
            description:
                'Check one recipe against the allergies recorded in PrepWise, and say which of '
                + 'them it conflicts with, if any. Use this before suggesting a recipe to someone '
                + 'with a recorded allergy, or before adapting a dish for them. Does not disclose '
                + 'how severe a conflict is — the same limit Settings promises for every assistant.',
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            inputSchema: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'The recipe name, or part of it.' }
                },
                required: ['name']
            },
            execute(args) {
                const wanted = String((args && args.name) || '').trim().toLowerCase();
                if (!wanted) return failure('A recipe name is required.');

                const recipe = findRecipe(wanted);
                if (!recipe) return recipeNotFound(wanted);

                if (typeof analyzeRecipeAllergies !== 'function') {
                    return failure('Allergy analysis is unavailable.');
                }

                // Only allergen names ever cross this boundary — never
                // `.severity` or `.safetyLevel`, which encode how severe.
                const analysis = analyzeRecipeAllergies(recipe);
                if (!analysis.hasConflicts) {
                    return reply(`${recipe.name} does not conflict with any allergy recorded in PrepWise.`);
                }

                const names = analysis.conflicts.map(c => c.name);
                return reply(`${recipe.name} conflicts with a recorded allergy: ${names.join(', ')}.`);
            }
        },

        {
            name: PREFIX + 'propose_inventory_items',
            description:
                'Propose adding items to the pantry — for example after reading a photograph of '
                + 'a fridge, a shelf, or a receipt. This does NOT change anything: it opens a '
                + 'preview in PrepWise showing exactly what would be added, and the user must '
                + 'confirm it. Report the result as a suggestion awaiting their approval.',
            // Not read-only: it opens a modal and stages data. It just cannot commit.
            annotations: { readOnlyHint: false, untrustedContentHint: true },
            inputSchema: {
                type: 'object',
                properties: {
                    items: {
                        type: 'array',
                        description: 'The items to propose adding.',
                        maxItems: MAX_PROPOSED_ITEMS,
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string', description: 'Item name, e.g. "Milk".' },
                                quantity: { type: 'number', description: 'How much is on hand.' },
                                unit: {
                                    type: 'string',
                                    enum: AGENT_UNITS,
                                    description: 'Unit of measurement.'
                                },
                                expirationDate: {
                                    type: 'string',
                                    description: 'Optional best-before date as YYYY-MM-DD, if legible.'
                                }
                            },
                            required: ['name']
                        }
                    }
                },
                required: ['items']
            },
            execute(args) {
                if (proposalPending()) return failure(BUSY);

                const proposed = args && Array.isArray(args.items) ? args.items : null;
                if (!proposed || !proposed.length) {
                    return failure('No items were provided.');
                }
                if (proposed.length > MAX_PROPOSED_ITEMS) {
                    return failure(
                        `That is ${proposed.length} items; ${MAX_PROPOSED_ITEMS} is the most that can be `
                        + 'proposed at once. Send them in smaller batches.');
                }
                if (typeof stageImport !== 'function' || typeof sanitizeBackup !== 'function') {
                    return failure('PrepWise cannot accept proposals right now.');
                }

                // Build a backup-shaped object and put it through the very same
                // gates a file goes through. The agent gets no shortcut.
                const draft = {
                    version: '1.0',
                    exportDate: new Date().toISOString(),
                    inventory: proposed.map(item => ({
                        name: item && item.name,
                        current: Number(item && item.quantity) || 0,
                        max: Number(item && item.quantity) || 0,
                        unit: item && item.unit,
                        hasExpiration: !!(item && item.expirationDate),
                        expirationDate: (item && item.expirationDate) || null
                    }))
                };

                const problem = typeof validateBackup === 'function' ? validateBackup(draft) : null;
                if (problem) return failure(`Those items could not be read: ${problem}.`);

                const { backup, notes } = sanitizeBackup(draft);
                const kept = (backup.inventory || []).length;
                if (!kept) return failure('None of those items survived validation.');

                // Duplicates by name are skipped on merge, so say so up front
                // rather than letting the agent report a count that will not
                // match what lands.
                const existing = new Set(inventory().map(i => String(i.name).toLowerCase()));
                const fresh = (backup.inventory || [])
                    .filter(i => !existing.has(String(i.name).toLowerCase()));

                stageImport(backup, notes, 'agent');

                const already = kept - fresh.length;
                return reply([
                    `${kept} item${kept === 1 ? '' : 's'} proposed and shown to the user for confirmation.`,
                    describeSkips(already, kept, 'in the pantry'),
                    'Nothing has been added yet — PrepWise is waiting for them to confirm in the app.'
                ].filter(Boolean).join(' '));
            }
        },

        {
            name: PREFIX + 'propose_recipe',
            description:
                'Propose one or more recipes to add to the cookbook, each with its ingredients '
                + 'and its method. A step may carry a countdown timer (timerSeconds), which the '
                + 'cook can start with one tap while cooking — use it for anything with a '
                + 'duration, like simmering or proving. This does NOT change anything: it opens '
                + 'a preview the user must confirm. It cannot touch the pantry: proposing a '
                + 'recipe never adds, removes or alters a single inventory item, so ingredients '
                + 'a recipe needs are not stocked by writing it down. Report the result as a '
                + 'suggestion awaiting their approval.',
            annotations: { readOnlyHint: false, untrustedContentHint: true },
            inputSchema: {
                type: 'object',
                properties: {
                    recipes: {
                        type: 'array',
                        description: 'The recipes to propose.',
                        maxItems: MAX_PROPOSED_RECIPES,
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string', description: 'Recipe name.' },
                                prepTime: {
                                    type: 'string',
                                    description: 'Free text. A bare number is read as minutes; '
                                        + '"overnight" or "1 hr 20" are equally valid.'
                                },
                                cookTime: { type: 'string', description: 'Free text, as prepTime.' },
                                servings: {
                                    type: 'string',
                                    description: 'Free text. A bare number is read as servings.'
                                },
                                ingredients: {
                                    type: 'array',
                                    description: 'What the recipe needs. This does not stock the pantry.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            item: { type: 'string', description: 'Ingredient name, e.g. "Plain Flour".' },
                                            amount: { type: 'string', description: 'How much, e.g. "250".' },
                                            unit: { type: 'string', enum: AGENT_UNITS, description: 'Unit of measurement.' }
                                        },
                                        required: ['item']
                                    }
                                },
                                steps: {
                                    type: 'array',
                                    description: 'The method, in order.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            type: {
                                                type: 'string',
                                                enum: ['step', 'paragraph'],
                                                description: '"step" is a numbered instruction; '
                                                    + '"paragraph" is a note that is not a step. Defaults to step.'
                                            },
                                            content: { type: 'string', description: 'The instruction text.' },
                                            timerSeconds: {
                                                type: 'number',
                                                description: 'Optional countdown for this step, in SECONDS '
                                                    + '(600 for ten minutes). Maximum 359999, i.e. 99:59:59. '
                                                    + 'Omit for steps with no duration.'
                                            }
                                        },
                                        required: ['content']
                                    }
                                }
                            },
                            required: ['name']
                        }
                    }
                },
                required: ['recipes']
            },
            execute(args) {
                if (proposalPending()) return failure(BUSY);

                const proposed = args && Array.isArray(args.recipes) ? args.recipes : null;
                if (!proposed || !proposed.length) {
                    return failure('No recipes were provided.');
                }
                if (proposed.length > MAX_PROPOSED_RECIPES) {
                    return failure(
                        `That is ${proposed.length} recipes; ${MAX_PROPOSED_RECIPES} is the most that can `
                        + 'be proposed at once. Send them in smaller batches.');
                }
                if (typeof stageImport !== 'function' || typeof sanitizeBackup !== 'function') {
                    return failure('PrepWise cannot accept proposals right now.');
                }

                /*
                 * No `inventory` key, deliberately and load-bearingly.
                 * mergeBackupData() handles recipes and inventory separately,
                 * so its absence is what makes this tool unable to touch the
                 * pantry — there is nothing for it to apply.
                 */
                const draft = {
                    version: '1.0',
                    exportDate: new Date().toISOString(),
                    recipes: proposed.map(recipe => ({
                        name: recipe && recipe.name,
                        // Free text throughout: "overnight" is a legitimate prep time.
                        prepTime: recipe && recipe.prepTime != null ? String(recipe.prepTime) : '',
                        cookTime: recipe && recipe.cookTime != null ? String(recipe.cookTime) : '',
                        servings: recipe && recipe.servings != null ? String(recipe.servings) : '',
                        ingredients: (recipe && Array.isArray(recipe.ingredients) ? recipe.ingredients : [])
                            .map(ing => ({
                                item: ing && ing.item,
                                // Stored as a string app-wide; read back with parseFloat.
                                amount: ing && ing.amount != null ? String(ing.amount) : '',
                                unit: ing && ing.unit
                            })),
                        steps: (recipe && Array.isArray(recipe.steps) ? recipe.steps : [])
                            .map(step => ({
                                type: step && step.type,
                                content: step && step.content,
                                // sanitizeStep() clamps this to 99:59:59 and drops it if zero.
                                timerSeconds: step && step.timerSeconds
                            }))
                    }))
                };

                const problem = typeof validateBackup === 'function' ? validateBackup(draft) : null;
                if (problem) return failure(`Those recipes could not be read: ${problem}.`);

                const { backup, notes } = sanitizeBackup(draft);
                const kept = (backup.recipes || []).length;
                if (!kept) return failure('None of those recipes survived validation — each needs a name.');

                const existing = new Set(recipes().map(r => String(r.name).toLowerCase()));
                const already = (backup.recipes || [])
                    .filter(r => existing.has(String(r.name).toLowerCase())).length;
                const timers = (backup.recipes || [])
                    .reduce((count, r) => count + (r.steps || []).filter(s => s.timerSeconds).length, 0);

                stageImport(backup, notes, 'agent-recipe');

                return reply([
                    `${kept} recipe${kept === 1 ? '' : 's'} proposed and shown to the user for confirmation`
                        + (timers ? `, including ${timers} step timer${timers === 1 ? '' : 's'}` : '')
                        + '.',
                    describeSkips(already, kept, 'in the cookbook'),
                    'Nothing has been added yet, and the pantry is not affected either way —'
                        + ' PrepWise is waiting for them to confirm in the app.'
                ].filter(Boolean).join(' '));
            }
        }
    ];

    // ---------------------------------------------------------------------
    // Registration
    // ---------------------------------------------------------------------

    let controller = null;

    /*
     * Off until asked for.
     *
     * Registration alone leaks nothing - only tool names and descriptions - so
     * defaulting on was defensible. But an app whose whole claim is that it
     * holds your allergies and lets nothing out should not open a second door
     * on your behalf and tell you afterwards. Opting in is one checkbox;
     * discovering you were already opted in is a different feeling entirely.
     */
    function isEnabled() {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (!raw) return false; // off until the user turns it on
            const parsed = JSON.parse(raw);
            return parsed?.enabled === true;
        } catch (error) {
            return false;
        }
    }

    function setEnabled(enabled) {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify({ enabled: !!enabled }));
        } catch (error) {
            /* a full or blocked store is not worth breaking the app over */
        }
        sync();
    }

    async function register() {
        const context = resolveModelContext();
        if (!context || controller) return;

        controller = new AbortController();
        for (const tool of TOOLS) {
            try {
                await context.registerTool(tool, { signal: controller.signal });
            } catch (error) {
                // One malformed tool must not take the rest of them down, and a
                // spec change is the likeliest cause. Log and carry on.
                console.warn('WebMCP: could not register ' + tool.name, error);
            }
        }
    }

    function unregister() {
        if (!controller) return;
        controller.abort();
        controller = null;
    }

    function sync() {
        if (!resolveModelContext()) return;
        if (isEnabled()) register();
        else unregister();
    }

    /*
     * Exposed for the Settings toggle, for tests, and for the console spike in
     * docs/webmcp-plan.md.
     *
     * `tools()` hands back the descriptors themselves, including their execute
     * callbacks, because getTools() cannot: the spec has it return
     * `RegisteredTool`, an introspection view carrying the name, description
     * and schema but *not* the handler — agents invoke through the browser, not
     * by calling execute directly. Without this there is no way to exercise a
     * handler from the console, which is exactly what verifying this feature
     * needs. It grants nothing new: same-origin script could already call
     * stageImport() and the rest of app.js on its own.
     */
    window.prepwiseAgent = {
        isSupported: () => resolveModelContext() !== null,
        isEnabled,
        setEnabled,
        toolNames: () => TOOLS.map(tool => tool.name),
        tools: () => TOOLS.slice()
    };

    function start() {
        const section = document.getElementById('agent-tools-section');
        const toggle = document.getElementById('agent-tools-toggle');

        // No dead control on a browser that cannot do this.
        if (!resolveModelContext()) return;

        if (section) section.classList.remove('hidden');
        if (toggle) toggle.checked = isEnabled();
        sync();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
