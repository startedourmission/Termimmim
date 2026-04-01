document.addEventListener('DOMContentLoaded', () => {
  const fs = new FileSystem();
  const git = new GitRepo();
  const handler = new CommandHandler(fs, git);
  let viEditor = null;

  const outputEl = document.getElementById('output');
  const promptEl = document.getElementById('prompt');
  const inputLeft = document.getElementById('input-left');
  const inputRight = document.getElementById('input-right');
  const cursorEl = document.getElementById('cursor');
  const terminalBody = document.getElementById('terminal-body');
  const hiddenInput = document.getElementById('hidden-input');

  let inputBuffer = '';
  let cursorPos = 0;
  let commandHistory = [];
  let historyIndex = -1;
  let tempInput = '';

  function getPrompt() {
    const branch = git.initialized ? ` <span class="color-cyan">(${git.currentBranch})</span>` : '';
    return `<span class="color-green bold">${fs.env?.USER || 'user'}@termimmim</span>:<span class="color-blue bold">${fs.getShortPath()}</span>${branch}$ `;
  }

  function getPromptText() {
    const branch = git.initialized ? ` (${git.currentBranch})` : '';
    return `${fs.env?.USER || 'user'}@termimmim:${fs.getShortPath()}${branch}$ `;
  }

  function updatePrompt() {
    promptEl.innerHTML = getPrompt();
  }

  function updateInput() {
    inputLeft.textContent = inputBuffer.slice(0, cursorPos);
    cursorEl.textContent = cursorPos < inputBuffer.length ? inputBuffer[cursorPos] : ' ';
    inputRight.textContent = inputBuffer.slice(cursorPos + 1);
  }

  function scrollToBottom() {
    terminalBody.scrollTop = terminalBody.scrollHeight;
  }

  function addOutput(html) {
    if (!html) return;
    const div = document.createElement('div');
    div.className = 'line';
    div.innerHTML = html;
    outputEl.appendChild(div);
  }

  function addPromptLine(text) {
    const div = document.createElement('div');
    div.className = 'line';
    div.innerHTML = getPrompt() + escapeHtml(text);
    outputEl.appendChild(div);
  }

  function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Vi integration
  let savedOutput = '';

  function openVi(path) {
    savedOutput = outputEl.innerHTML;
    const terminalRef = {
      exitVi: () => {
        viEditor = null;
        outputEl.innerHTML = savedOutput;
        inputBuffer = '';
        cursorPos = 0;
        hiddenInput.value = '';
        updatePrompt();
        updateInput();
        syncHiddenInput();
        hiddenInput.focus();
        scrollToBottom();
      }
    };
    viEditor = new ViEditor(fs, terminalRef);
    const err = viEditor.open(path);
    if (err) {
      viEditor = null;
      return err;
    }
    return null;
  }

  // Make openVi available to CommandHandler
  handler.openVi = openVi;

  function processCommand(input) {
    addPromptLine(input);

    if (input.trim()) {
      commandHistory.push(input.trim());
    }
    historyIndex = -1;
    tempInput = '';

    const result = handler.execute(input);

    if (result === '__CLEAR__') {
      outputEl.innerHTML = '';
    } else if (result === '__HISTORY__') {
      const hist = commandHistory.map((c, i) => `  ${i + 1}  ${escapeHtml(c)}`).join('\n');
      addOutput(hist);
    } else if (result) {
      addOutput(result);
    }

    updatePrompt();
    scrollToBottom();
  }

  function handleTab() {
    const before = inputBuffer.slice(0, cursorPos);
    const parts = before.split(' ');
    const partial = parts[parts.length - 1];
    if (!partial) return;

    // Determine completions
    let completions = [];

    if (parts.length === 1) {
      // Command completion
      const cmds = ['ls', 'cd', 'pwd', 'cat', 'echo', 'mkdir', 'touch', 'rm', 'cp', 'mv',
        'clear', 'whoami', 'date', 'history', 'git', 'help', 'export', 'env',
        'which', 'head', 'tail', 'wc', 'grep', 'vi', 'vim', 'man'];
      completions = cmds.filter(c => c.startsWith(partial));
    } else {
      // File/dir completion
      const lastSlash = partial.lastIndexOf('/');
      let dirPath, prefix;
      if (lastSlash >= 0) {
        dirPath = partial.slice(0, lastSlash) || '/';
        prefix = partial.slice(lastSlash + 1);
      } else {
        dirPath = '.';
        prefix = partial;
      }
      const result = fs.listDir(dirPath);
      if (result.entries) {
        completions = result.entries
          .filter(e => e.name.startsWith(prefix))
          .map(e => {
            const base = lastSlash >= 0 ? partial.slice(0, lastSlash + 1) : '';
            return base + e.name + (e.type === 'dir' ? '/' : '');
          });
      }

      // Git subcommand completion
      if (parts[0] === 'git' && parts.length === 2) {
        const gitCmds = ['init', 'status', 'add', 'commit', 'log', 'branch', 'checkout', 'merge', 'diff', 'restore', 'help'];
        completions = gitCmds.filter(c => c.startsWith(partial));
      }
    }

    if (completions.length === 1) {
      parts[parts.length - 1] = completions[0];
      const after = inputBuffer.slice(cursorPos);
      inputBuffer = parts.join(' ') + after;
      cursorPos = parts.join(' ').length;
      updateInput();
    } else if (completions.length > 1) {
      addPromptLine(inputBuffer);
      addOutput(completions.join('  '));
      updatePrompt();
      scrollToBottom();
    }
  }

  // Welcome message - responsive ASCII art
  function getWelcome() {
    const narrow = window.innerWidth < 500;
    if (narrow) {
      return `<span class="bold color-cyan">TERMIMMIM</span>
<span class="color-gray">Terminal Simulator</span>
<span class="color-gray">Type "help" to get started</span>`;
    }
    return `<span class="bold color-cyan">  _____ _____ ____  __  __ ___ __  __ __  __ ___ __  __
 |_   _| ____|  _ \\|  \\/  |_ _|  \\/  |  \\/  |_ _|  \\/  |
   | | |  _| | |_) | |\\/| || || |\\/| | |\\/| || || |\\/| |
   | | | |___|  _ &lt;| |  | || || |  | | |  | || || |  | |
   |_| |_____|_| \\_\\_|  |_|___|_|  |_|_|  |_|___|_|  |_|</span>
<span class="color-gray">Terminal Simulator for Practice - Type "help" to get started</span>`;
  }
  addOutput(getWelcome());

  updatePrompt();
  updateInput();
  scrollToBottom();

  // Sync hidden input with our buffer
  function syncHiddenInput() {
    hiddenInput.value = inputBuffer;
    hiddenInput.selectionStart = cursorPos;
    hiddenInput.selectionEnd = cursorPos;
  }

  // Focus handling
  terminalBody.addEventListener('click', () => {
    hiddenInput.focus();
  });

  // Prevent terminal body from losing focus on touch
  terminalBody.addEventListener('touchstart', () => {
    setTimeout(() => hiddenInput.focus(), 10);
  });

  // Auto-focus on load
  hiddenInput.focus();

  // Mobile input: use the input event as the primary source of typed characters
  let composing = false;

  hiddenInput.addEventListener('compositionstart', () => { composing = true; });
  hiddenInput.addEventListener('compositionend', () => {
    composing = false;
    // After composition ends, sync from hidden input
    inputBuffer = hiddenInput.value;
    cursorPos = hiddenInput.selectionStart || inputBuffer.length;
    updateInput();
    scrollToBottom();
  });

  hiddenInput.addEventListener('input', (e) => {
    if (composing) return;

    if (viEditor && viEditor.active) {
      // In vi mode, extract what was typed
      const newVal = hiddenInput.value;
      if (viEditor.mode === 'insert' && newVal.length > 0) {
        // Find what changed
        viEditor.handleInput(newVal);
      }
      hiddenInput.value = '';
      return;
    }

    // Sync our buffer from the hidden input's actual value
    inputBuffer = hiddenInput.value;
    cursorPos = hiddenInput.selectionStart || inputBuffer.length;
    updateInput();
    scrollToBottom();
  });

  // Keyboard events - only special keys and ctrl combos
  // All normal character input is handled by the 'input' event above
  hiddenInput.addEventListener('keydown', (e) => {
    const key = e.key;

    // Vi mode: route all keydown to vi
    if (viEditor && viEditor.active) {
      e.preventDefault();
      hiddenInput.value = '';
      viEditor.handleKey(key, e.ctrlKey, e.shiftKey);
      return;
    }

    // Ctrl combos (desktop only)
    if (e.ctrlKey && !e.metaKey) {
      switch (key) {
        case 'c':
          e.preventDefault();
          addPromptLine(inputBuffer + '^C');
          inputBuffer = '';
          cursorPos = 0;
          updateInput();
          syncHiddenInput();
          updatePrompt();
          scrollToBottom();
          return;
        case 'l':
          e.preventDefault();
          outputEl.innerHTML = '';
          scrollToBottom();
          return;
        case 'a':
          e.preventDefault();
          cursorPos = 0;
          updateInput();
          syncHiddenInput();
          return;
        case 'e':
          e.preventDefault();
          cursorPos = inputBuffer.length;
          updateInput();
          syncHiddenInput();
          return;
        case 'u':
          e.preventDefault();
          inputBuffer = inputBuffer.slice(cursorPos);
          cursorPos = 0;
          updateInput();
          syncHiddenInput();
          return;
        case 'k':
          e.preventDefault();
          inputBuffer = inputBuffer.slice(0, cursorPos);
          updateInput();
          syncHiddenInput();
          return;
      }
    }

    // Special keys
    switch (key) {
      case 'Enter':
        e.preventDefault();
        processCommand(inputBuffer);
        inputBuffer = '';
        cursorPos = 0;
        updateInput();
        syncHiddenInput();
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (commandHistory.length > 0) {
          if (historyIndex === -1) {
            tempInput = inputBuffer;
            historyIndex = commandHistory.length - 1;
          } else if (historyIndex > 0) {
            historyIndex--;
          }
          inputBuffer = commandHistory[historyIndex];
          cursorPos = inputBuffer.length;
          updateInput();
          syncHiddenInput();
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (historyIndex !== -1) {
          if (historyIndex < commandHistory.length - 1) {
            historyIndex++;
            inputBuffer = commandHistory[historyIndex];
          } else {
            historyIndex = -1;
            inputBuffer = tempInput;
          }
          cursorPos = inputBuffer.length;
          updateInput();
          syncHiddenInput();
        }
        break;

      case 'Tab':
        e.preventDefault();
        handleTab();
        syncHiddenInput();
        break;
    }
  });

  // Redirect focus when typing outside hidden input (desktop)
  document.addEventListener('keydown', (e) => {
    if (document.activeElement !== hiddenInput) {
      hiddenInput.focus();
    }
  });
});
