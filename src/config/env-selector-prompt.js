const AutocompletePrompt = require('inquirer-autocomplete-prompt').default;

/**
 * Custom prompt extending autocomplete-prompt with:
 * - Pinned Custom/Done items at the top
 * - Left/Right arrow keys to switch between categories
 * - Category header shows current index (e.g. "Provider (2/13)")
 *
 * Expects opt.sourceController with:
 * - switchCategory(dir): 'prev' | 'next' -> void
 * - get currentCategory(): string
 */
class EnvSelectorPrompt extends AutocompletePrompt {
  constructor(questions, rl, answers) {
    super(questions, rl, answers);
    this.sourceController = this.opt.sourceController || null;
  }

  onKeypress(e) {
    const keyName = (e.key && e.key.name) || undefined;

    // Handle left/right for category switching
    if (keyName === 'left' || keyName === 'right') {
      if (this.sourceController) {
        const dir = keyName === 'left' ? 'prev' : 'next';
        this.sourceController.switchCategory(dir);
        this.selected = 0;
        // Clear search input so category mode is shown
        this.rl.line = '';
        this.search(undefined);
      }
      return;
    }

    // All other keys: delegate to parent (up, down, typing, enter, etc.)
    super.onKeypress(e);
  }
}

module.exports = EnvSelectorPrompt;
