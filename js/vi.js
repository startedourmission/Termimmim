class ViEditor {
  constructor(fs, terminal) {
    this.fs = fs;
    this.terminal = terminal;
    this.active = false;
    this.mode = 'normal'; // normal, insert, command
    this.lines = [''];
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.scrollOffset = 0;
    this.filePath = '';
    this.statusMsg = '';
    this.commandBuffer = '';
    this.modified = false;
    this.yankBuffer = '';
    this.lastKey = '';
  }

  open(path) {
    this.filePath = path;
    this.active = true;
    this.mode = 'normal';
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.scrollOffset = 0;
    this.statusMsg = '';
    this.commandBuffer = '';
    this.modified = false;
    this.lastKey = '';

    if (path) {
      const node = this.fs.getNode(path);
      if (node && node.type === 'dir') {
        this.active = false;
        return `<span class="color-red">"${path}" is a directory</span>`;
      }

      if (node) {
        this.lines = node.content.split('\n');
        this.statusMsg = `"${path}" ${this.lines.length}L`;
      } else {
        this.lines = [''];
        this.statusMsg = `"${path}" [New File]`;
      }
    } else {
      this.lines = [''];
      this.statusMsg = '[No Name]';
    }

    this.render();
    return null;
  }

  getVisibleRows() {
    const bodyEl = document.getElementById('terminal-body');
    const lineHeight = 14 * 1.6; // font-size * line-height
    return Math.floor((bodyEl.clientHeight - 40) / lineHeight) - 2; // -2 for status + cmd line
  }

  render() {
    const rows = this.getVisibleRows();
    const outputEl = document.getElementById('output');
    const inputLine = document.getElementById('input-line');
    inputLine.style.display = 'none';

    // Adjust scroll to keep cursor visible
    if (this.cursorRow < this.scrollOffset) {
      this.scrollOffset = this.cursorRow;
    }
    if (this.cursorRow >= this.scrollOffset + rows) {
      this.scrollOffset = this.cursorRow - rows + 1;
    }

    const htmlLines = [];

    for (let i = 0; i < rows; i++) {
      const lineIdx = i + this.scrollOffset;
      if (lineIdx < this.lines.length) {
        const lineText = this.lines[lineIdx];
        const lineNum = String(lineIdx + 1).padStart(3, ' ');
        let displayLine = this._escapeHtml(lineText);

        if (lineIdx === this.cursorRow) {
          displayLine = this._renderCursorLine(lineText);
        }

        htmlLines.push(
          `<span class="color-yellow">${lineNum} </span>${displayLine}`
        );
      } else {
        htmlLines.push('<span class="color-blue">~</span>');
      }
    }

    // Status line
    const modeStr = this.mode === 'insert'
      ? '<span class="vi-status-insert">-- INSERT --</span>'
      : this.mode === 'command'
        ? ''
        : '';
    const fileInfo = `${this.filePath}${this.modified ? ' [+]' : ''}`;
    const posInfo = `${this.cursorRow + 1},${this.cursorCol + 1}`;
    htmlLines.push(
      `<div class="vi-status-bar"><span>${modeStr} ${fileInfo}</span><span>${posInfo}</span></div>`
    );

    // Command / message line
    if (this.mode === 'command') {
      htmlLines.push(`:${this._escapeHtml(this.commandBuffer)}<span class="vi-cmd-cursor"> </span>`);
    } else if (this.statusMsg) {
      htmlLines.push(`<span class="color-gray">${this._escapeHtml(this.statusMsg)}</span>`);
    } else {
      htmlLines.push('');
    }

    outputEl.innerHTML = htmlLines.map(l => `<div class="line">${l}</div>`).join('');
  }

  _renderCursorLine(lineText) {
    const escaped = this._escapeHtml(lineText);
    const chars = [...escaped];
    const col = this.cursorCol;

    if (chars.length === 0) {
      return '<span class="vi-cursor"> </span>';
    }

    const before = chars.slice(0, col).join('');
    const cursorChar = col < chars.length ? chars[col] : ' ';
    const after = col < chars.length ? chars.slice(col + 1).join('') : '';

    return `${before}<span class="vi-cursor">${cursorChar}</span>${after}`;
  }

  handleKey(key, ctrl, shift) {
    this.statusMsg = '';

    if (this.mode === 'normal') {
      this._handleNormal(key, ctrl);
    } else if (this.mode === 'insert') {
      this._handleInsert(key, ctrl);
    } else if (this.mode === 'command') {
      this._handleCommand(key);
    }

    this.render();
  }

  _handleNormal(key, ctrl) {
    const line = this.lines[this.cursorRow] || '';

    switch (key) {
      // Movement
      case 'h': case 'ArrowLeft':
        if (this.cursorCol > 0) this.cursorCol--;
        break;
      case 'l': case 'ArrowRight':
        if (this.cursorCol < line.length - 1) this.cursorCol++;
        break;
      case 'j': case 'ArrowDown':
        if (this.cursorRow < this.lines.length - 1) {
          this.cursorRow++;
          this._clampCol();
        }
        break;
      case 'k': case 'ArrowUp':
        if (this.cursorRow > 0) {
          this.cursorRow--;
          this._clampCol();
        }
        break;

      case '0': case 'Home':
        this.cursorCol = 0;
        break;
      case '$': case 'End':
        this.cursorCol = Math.max(0, line.length - 1);
        break;

      case 'g':
        if (this.lastKey === 'g') {
          this.cursorRow = 0;
          this._clampCol();
          this.lastKey = '';
          return;
        }
        this.lastKey = 'g';
        return;

      case 'G':
        this.cursorRow = this.lines.length - 1;
        this._clampCol();
        break;

      case 'w':
        this._moveWord(1);
        break;
      case 'b':
        this._moveWord(-1);
        break;

      // Enter insert mode
      case 'i':
        this.mode = 'insert';
        break;
      case 'a':
        this.mode = 'insert';
        this.cursorCol = Math.min(this.cursorCol + 1, line.length);
        break;
      case 'A':
        this.mode = 'insert';
        this.cursorCol = line.length;
        break;
      case 'I':
        this.mode = 'insert';
        this.cursorCol = 0;
        break;
      case 'o':
        this.lines.splice(this.cursorRow + 1, 0, '');
        this.cursorRow++;
        this.cursorCol = 0;
        this.mode = 'insert';
        this.modified = true;
        break;
      case 'O':
        this.lines.splice(this.cursorRow, 0, '');
        this.cursorCol = 0;
        this.mode = 'insert';
        this.modified = true;
        break;

      // Editing
      case 'x':
        if (line.length > 0) {
          this.lines[this.cursorRow] = line.slice(0, this.cursorCol) + line.slice(this.cursorCol + 1);
          this._clampCol();
          this.modified = true;
        }
        break;

      case 'd':
        if (this.lastKey === 'd') {
          this.yankBuffer = this.lines[this.cursorRow];
          this.lines.splice(this.cursorRow, 1);
          if (this.lines.length === 0) this.lines = [''];
          if (this.cursorRow >= this.lines.length) this.cursorRow = this.lines.length - 1;
          this._clampCol();
          this.modified = true;
          this.lastKey = '';
          return;
        }
        this.lastKey = 'd';
        return;

      case 'y':
        if (this.lastKey === 'y') {
          this.yankBuffer = this.lines[this.cursorRow];
          this.statusMsg = '1 line yanked';
          this.lastKey = '';
          return;
        }
        this.lastKey = 'y';
        return;

      case 'p':
        if (this.yankBuffer !== '') {
          this.lines.splice(this.cursorRow + 1, 0, this.yankBuffer);
          this.cursorRow++;
          this.cursorCol = 0;
          this.modified = true;
        }
        break;

      case 'u':
        this.statusMsg = 'undo not supported in this simulator';
        break;

      // Command mode
      case ':':
        this.mode = 'command';
        this.commandBuffer = '';
        break;

      // Search hint
      case '/':
        this.statusMsg = 'search not supported in this simulator';
        break;
    }

    this.lastKey = key;
  }

  _handleInsert(key, ctrl) {
    if (key === 'Escape') {
      this.mode = 'normal';
      if (this.cursorCol > 0) this.cursorCol--;
      return;
    }

    if (key === 'Enter') {
      const line = this.lines[this.cursorRow];
      const before = line.slice(0, this.cursorCol);
      const after = line.slice(this.cursorCol);
      this.lines[this.cursorRow] = before;
      this.lines.splice(this.cursorRow + 1, 0, after);
      this.cursorRow++;
      this.cursorCol = 0;
      this.modified = true;
      return;
    }

    if (key === 'Backspace') {
      if (this.cursorCol > 0) {
        const line = this.lines[this.cursorRow];
        this.lines[this.cursorRow] = line.slice(0, this.cursorCol - 1) + line.slice(this.cursorCol);
        this.cursorCol--;
        this.modified = true;
      } else if (this.cursorRow > 0) {
        const prev = this.lines[this.cursorRow - 1];
        const curr = this.lines[this.cursorRow];
        this.lines[this.cursorRow - 1] = prev + curr;
        this.lines.splice(this.cursorRow, 1);
        this.cursorRow--;
        this.cursorCol = prev.length;
        this.modified = true;
      }
      return;
    }

    if (key === 'ArrowLeft') { if (this.cursorCol > 0) this.cursorCol--; return; }
    if (key === 'ArrowRight') { if (this.cursorCol < this.lines[this.cursorRow].length) this.cursorCol++; return; }
    if (key === 'ArrowUp') { if (this.cursorRow > 0) { this.cursorRow--; this._clampCol(); } return; }
    if (key === 'ArrowDown') { if (this.cursorRow < this.lines.length - 1) { this.cursorRow++; this._clampCol(); } return; }

    // Regular character
    if (key.length === 1 && !ctrl) {
      const line = this.lines[this.cursorRow];
      this.lines[this.cursorRow] = line.slice(0, this.cursorCol) + key + line.slice(this.cursorCol);
      this.cursorCol++;
      this.modified = true;
    }
  }

  _handleCommand(key) {
    if (key === 'Enter') {
      this._executeCommand(this.commandBuffer);
      return;
    }
    if (key === 'Escape') {
      this.mode = 'normal';
      this.commandBuffer = '';
      return;
    }
    if (key === 'Backspace') {
      if (this.commandBuffer.length > 0) {
        this.commandBuffer = this.commandBuffer.slice(0, -1);
      } else {
        this.mode = 'normal';
      }
      return;
    }
    if (key.length === 1) {
      this.commandBuffer += key;
    }
  }

  _executeCommand(cmd) {
    this.mode = 'normal';
    const trimmed = cmd.trim();

    if (trimmed === 'w' || trimmed === 'write') {
      this._save();
      return;
    }
    if (trimmed === 'q' || trimmed === 'quit') {
      if (this.modified) {
        this.statusMsg = 'No write since last change (add ! to override)';
        return;
      }
      this._quit();
      return;
    }
    if (trimmed === 'q!' || trimmed === 'quit!') {
      this._quit();
      return;
    }
    if (trimmed === 'wq' || trimmed === 'x') {
      this._save();
      this._quit();
      return;
    }
    if (trimmed.startsWith('w ')) {
      this.filePath = trimmed.slice(2).trim();
      this._save();
      return;
    }

    // Line number
    const lineNum = parseInt(trimmed);
    if (!isNaN(lineNum) && lineNum > 0) {
      this.cursorRow = Math.min(lineNum - 1, this.lines.length - 1);
      this._clampCol();
      return;
    }

    this.statusMsg = `Not a command: ${trimmed}`;
  }

  _save() {
    if (!this.filePath) {
      this.statusMsg = 'No file name (use :w filename)';
      return;
    }
    const content = this.lines.join('\n');
    const result = this.fs.writeFile(this.filePath, content, false);
    if (result.error) {
      this.statusMsg = result.error;
    } else {
      this.modified = false;
      this.statusMsg = `"${this.filePath}" ${this.lines.length}L written`;
    }
  }

  _quit() {
    this.active = false;
    const inputLine = document.getElementById('input-line');
    inputLine.style.display = 'flex';
    this.terminal.exitVi();
  }

  _clampCol() {
    const maxCol = this.mode === 'insert'
      ? (this.lines[this.cursorRow] || '').length
      : Math.max(0, (this.lines[this.cursorRow] || '').length - 1);
    this.cursorCol = Math.min(this.cursorCol, maxCol);
  }

  _moveWord(dir) {
    const line = this.lines[this.cursorRow] || '';
    if (dir > 0) {
      let i = this.cursorCol;
      while (i < line.length && /\w/.test(line[i])) i++;
      while (i < line.length && /\W/.test(line[i])) i++;
      this.cursorCol = Math.min(i, Math.max(0, line.length - 1));
    } else {
      let i = this.cursorCol;
      if (i > 0) i--;
      while (i > 0 && /\W/.test(line[i])) i--;
      while (i > 0 && /\w/.test(line[i - 1])) i--;
      this.cursorCol = i;
    }
  }

  handleInput(text) {
    // For mobile: handle typed text in insert mode
    if (this.mode === 'insert') {
      for (const ch of text) {
        this._handleInsert(ch, false);
      }
      this.render();
    }
  }

  _escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
