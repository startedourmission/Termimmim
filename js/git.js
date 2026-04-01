class GitRepo {
  constructor() {
    this.initialized = false;
    this.branches = {};
    this.currentBranch = 'main';
    this.staged = [];      // staged file paths
    this.commits = [];      // commit log
    this.tracking = {};     // path -> last committed content snapshot
    this.mergeConflict = null;
  }

  init() {
    if (this.initialized) return { error: 'Reinitialized existing Git repository' };
    this.initialized = true;
    this.branches = { main: [] };
    this.currentBranch = 'main';
    this.staged = [];
    this.commits = [];
    this.tracking = {};
    return { output: 'Initialized empty Git repository' };
  }

  assertInit() {
    if (!this.initialized) return 'fatal: not a git repository (use "git init" first)';
    return null;
  }

  status(fs) {
    const err = this.assertInit();
    if (err) return { error: err };

    const lines = [];
    lines.push(`<span class="tip" data-tip="${I18N.t('tip.git.onbranch')}">On branch ${this.currentBranch}</span>`);

    if (this.commits.length === 0) {
      lines.push('', 'No commits yet', '');
    } else {
      lines.push('');
    }

    // Staged files
    const stagedFiles = [...new Set(this.staged)];
    if (stagedFiles.length > 0) {
      lines.push(`<span class="tip" data-tip="${I18N.t('tip.git.staged')}">Changes to be committed:</span>`);
      lines.push('  (use "git restore --staged <file>" to unstage)');
      for (const f of stagedFiles) {
        const isNew = !this.tracking[f];
        const tipMsg = isNew ? I18N.t('tip.git.newfile') : I18N.t('tip.git.modified');
        lines.push(`\t<span class="tip" data-tip="${tipMsg}"><span class="color-green">${isNew ? 'new file' : 'modified'}:   ${f}</span></span>`);
      }
      lines.push('');
    }

    // Modified but not staged
    const modified = [];
    for (const [path, content] of Object.entries(this.tracking)) {
      if (this.staged.includes(path)) continue;
      const node = fs.getNode(path);
      if (!node) {
        modified.push({ path, status: 'deleted' });
      } else if (node.content !== content) {
        modified.push({ path, status: 'modified' });
      }
    }
    if (modified.length > 0) {
      lines.push(`<span class="tip" data-tip="${I18N.t('tip.git.notstaged')}">Changes not staged for commit:</span>`);
      lines.push('  (use "git add <file>" to update what will be committed)');
      for (const m of modified) {
        const tipMsg = m.status === 'deleted' ? I18N.t('tip.git.deleted') : I18N.t('tip.git.unstaged_modified');
        lines.push(`\t<span class="tip" data-tip="${tipMsg}"><span class="color-red">${m.status}:   ${m.path}</span></span>`);
      }
      lines.push('');
    }

    // Untracked files
    const allFiles = fs.getAllFiles();
    const untracked = allFiles.filter(f => !this.tracking.hasOwnProperty(f) && !this.staged.includes(f));
    if (untracked.length > 0) {
      lines.push(`<span class="tip" data-tip="${I18N.t('tip.git.untracked')}">Untracked files:</span>`);
      lines.push('  (use "git add <file>" to include in what will be committed)');
      for (const f of untracked) {
        lines.push(`\t<span class="tip" data-tip="${I18N.t('tip.git.untracked_file')}"><span class="color-red">${f}</span></span>`);
      }
      lines.push('');
    }

    if (stagedFiles.length === 0 && modified.length === 0 && untracked.length === 0) {
      lines.push('nothing to commit, working tree clean');
    }

    return { output: lines.join('\n') };
  }

  add(paths, fs) {
    const err = this.assertInit();
    if (err) return { error: err };

    if (paths.length === 0) return { error: 'Nothing specified, nothing added.' };

    for (const p of paths) {
      if (p === '.' || p === '-A') {
        const allFiles = fs.getAllFiles();
        for (const f of allFiles) {
          if (!this.staged.includes(f)) this.staged.push(f);
        }
        // Also stage deletions
        for (const tracked of Object.keys(this.tracking)) {
          if (!allFiles.includes(tracked) && !this.staged.includes(tracked)) {
            this.staged.push(tracked);
          }
        }
        return {};
      }

      const resolved = fs.resolvePath(p);
      const rel = resolved.startsWith(fs.currentPath + '/')
        ? resolved.slice(fs.currentPath.length + 1)
        : resolved.slice(1);

      const node = fs.getNode(p);
      if (!node && !this.tracking[rel]) {
        return { error: `fatal: pathspec '${p}' did not match any files` };
      }
      if (node && node.type === 'dir') {
        const files = fs.getAllFiles(resolved, rel);
        for (const f of files) {
          if (!this.staged.includes(f)) this.staged.push(f);
        }
      } else {
        if (!this.staged.includes(rel)) this.staged.push(rel);
      }
    }
    return {};
  }

  commit(message, fs) {
    const err = this.assertInit();
    if (err) return { error: err };

    if (!message) return { error: 'Aborting commit due to empty commit message.' };
    if (this.staged.length === 0) {
      return { error: 'nothing to commit (use "git add" to track files)' };
    }

    const stagedFiles = [...new Set(this.staged)];
    const hash = this._randomHash();
    const commit = {
      hash,
      message,
      branch: this.currentBranch,
      files: [...stagedFiles],
      date: new Date().toLocaleString(),
    };

    // Update tracking
    for (const f of stagedFiles) {
      const node = fs.getNode(f);
      if (node) {
        this.tracking[f] = node.content;
      } else {
        delete this.tracking[f];
      }
    }

    this.commits.unshift(commit);
    if (!this.branches[this.currentBranch]) this.branches[this.currentBranch] = [];
    this.branches[this.currentBranch].unshift(hash);
    this.staged = [];

    return {
      output: `[${this.currentBranch} ${hash.slice(0, 7)}] ${message}\n ${stagedFiles.length} file(s) changed`
    };
  }

  log() {
    const err = this.assertInit();
    if (err) return { error: err };

    if (this.commits.length === 0) {
      return { error: "fatal: your current branch does not have any commits yet" };
    }

    const branchCommits = this.commits.filter(c =>
      this.branches[this.currentBranch]?.includes(c.hash)
    );

    const lines = [];
    for (const c of branchCommits) {
      const isHead = c === branchCommits[0];
      lines.push(`<span class="color-yellow">commit ${c.hash}</span>${isHead ? ` <span class="color-cyan">(HEAD -> ${this.currentBranch})</span>` : ''}`);
      lines.push(`Date:   ${c.date}`);
      lines.push('');
      lines.push(`    ${c.message}`);
      lines.push('');
    }
    return { output: lines.join('\n') };
  }

  branch(args) {
    const err = this.assertInit();
    if (err) return { error: err };

    if (args.length === 0) {
      const lines = Object.keys(this.branches).sort().map(b =>
        b === this.currentBranch
          ? `* <span class="color-green">${b}</span>`
          : `  ${b}`
      );
      return { output: lines.join('\n') };
    }

    if (args[0] === '-d' || args[0] === '-D') {
      const name = args[1];
      if (!name) return { error: 'fatal: branch name required' };
      if (!this.branches[name]) return { error: `error: branch '${name}' not found` };
      if (name === this.currentBranch) return { error: `error: Cannot delete branch '${name}' checked out` };
      delete this.branches[name];
      return { output: `Deleted branch ${name}` };
    }

    const name = args[0];
    if (this.branches[name]) return { error: `fatal: A branch named '${name}' already exists` };
    if (this.commits.length === 0) return { error: 'fatal: Not a valid object name: no commits yet' };
    this.branches[name] = [...(this.branches[this.currentBranch] || [])];
    return { output: `Created branch '${name}'` };
  }

  checkout(args, fs) {
    const err = this.assertInit();
    if (err) return { error: err };

    if (args.length === 0) return { error: 'error: no branch specified' };

    let branchName = args[0];
    let createNew = false;

    if (args[0] === '-b') {
      if (!args[1]) return { error: 'fatal: branch name required' };
      branchName = args[1];
      createNew = true;
    }

    if (createNew) {
      if (this.branches[branchName]) return { error: `fatal: A branch named '${branchName}' already exists` };
      if (this.commits.length === 0) return { error: 'fatal: Not a valid object name: no commits yet' };
      this.branches[branchName] = [...(this.branches[this.currentBranch] || [])];
    } else {
      if (!this.branches[branchName]) return { error: `error: pathspec '${branchName}' did not match any known branch` };
    }

    if (this.staged.length > 0) {
      return { error: 'error: Your local changes would be overwritten by checkout.\nPlease commit or stash them.' };
    }

    this.currentBranch = branchName;
    return { output: `Switched to branch '${branchName}'` };
  }

  merge(args) {
    const err = this.assertInit();
    if (err) return { error: err };

    if (args.length === 0) return { error: 'fatal: no branch specified' };

    const branchName = args[0];
    if (!this.branches[branchName]) return { error: `merge: '${branchName}' - not something we can merge` };
    if (branchName === this.currentBranch) return { error: 'Already up to date.' };

    // Simple merge: add all commits from the other branch
    const otherCommits = this.branches[branchName] || [];
    const currentCommits = this.branches[this.currentBranch] || [];

    const newCommits = otherCommits.filter(h => !currentCommits.includes(h));
    if (newCommits.length === 0) return { output: 'Already up to date.' };

    this.branches[this.currentBranch] = [...newCommits, ...currentCommits];

    return {
      output: `Merge made by the 'recursive' strategy.\n ${newCommits.length} commit(s) merged from ${branchName}`
    };
  }

  diff(fs) {
    const err = this.assertInit();
    if (err) return { error: err };

    const lines = [];
    // Show diff for tracked files
    for (const [path, oldContent] of Object.entries(this.tracking)) {
      const node = fs.getNode(path);
      if (!node) {
        lines.push(`<span class="color-red">deleted: ${path}</span>`);
        continue;
      }
      if (node.content !== oldContent) {
        lines.push(`<span class="bold">diff --git a/${path} b/${path}</span>`);
        const oldLines = oldContent.split('\n');
        const newLines = node.content.split('\n');
        for (const l of oldLines) {
          if (!newLines.includes(l)) lines.push(`<span class="color-red">- ${this._escapeHtml(l)}</span>`);
        }
        for (const l of newLines) {
          if (!oldLines.includes(l)) lines.push(`<span class="color-green">+ ${this._escapeHtml(l)}</span>`);
        }
        lines.push('');
      }
    }

    if (lines.length === 0) return { output: '' };
    return { output: lines.join('\n') };
  }

  restoreStaged(paths) {
    const err = this.assertInit();
    if (err) return { error: err };

    for (const p of paths) {
      this.staged = this.staged.filter(f => f !== p);
    }
    return {};
  }

  _randomHash() {
    const chars = '0123456789abcdef';
    let hash = '';
    for (let i = 0; i < 40; i++) hash += chars[Math.floor(Math.random() * 16)];
    return hash;
  }

  _escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
