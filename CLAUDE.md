# CLAUDE.md - AI Assistant Guide for kali-web-app

> This file provides guidance for AI assistants working on this repository.

## Project Overview

**Repository:** kali-web-app
**Status:** New/Initial Setup
**Purpose:** Kali Linux themed web application

This is a newly initialized repository. The codebase is being set up and will contain a web application related to Kali Linux tooling or security workflows.

## Repository Structure

```
kali-web-app/
├── CLAUDE.md          # This file - AI assistant guidance
├── README.md          # Project documentation (to be created)
├── .git/              # Git version control
└── [project files]    # To be added as development progresses
```

## Development Guidelines

### Getting Started

When setting up this project, consider the following structure based on common web application patterns:

**For a Node.js/JavaScript project:**
```
├── src/               # Source code
│   ├── components/    # UI components
│   ├── pages/         # Page components/routes
│   ├── services/      # API and business logic
│   └── utils/         # Utility functions
├── public/            # Static assets
├── tests/             # Test files
├── package.json       # Dependencies and scripts
└── README.md          # Documentation
```

**For a Python/Flask/Django project:**
```
├── app/               # Application code
│   ├── routes/        # API routes
│   ├── models/        # Data models
│   ├── services/      # Business logic
│   └── templates/     # HTML templates
├── static/            # Static assets
├── tests/             # Test files
├── requirements.txt   # Python dependencies
└── README.md          # Documentation
```

### Code Style Conventions

- Use consistent indentation (2 or 4 spaces, no tabs)
- Follow language-specific style guides (ESLint for JS, PEP 8 for Python)
- Write descriptive variable and function names
- Keep functions small and focused on single responsibilities
- Comment complex logic, but prefer self-documenting code

### Git Workflow

1. **Branch Naming:** Use descriptive branch names
   - Features: `feature/description`
   - Bugfixes: `fix/description`
   - AI work: `claude/session-id`

2. **Commit Messages:** Write clear, descriptive commit messages
   - Use imperative mood ("Add feature" not "Added feature")
   - Keep first line under 50 characters
   - Add detailed description if needed

3. **Before Committing:**
   - Run tests if available
   - Check for linting errors
   - Review changes with `git diff`

### Security Considerations

Given the Kali Linux theme, security is paramount:

- **Never commit secrets:** API keys, passwords, tokens
- **Input validation:** Always validate and sanitize user input
- **Avoid OWASP Top 10:** SQL injection, XSS, CSRF, etc.
- **Use HTTPS:** For all external communications
- **Principle of least privilege:** Minimal permissions for all operations
- **Audit dependencies:** Keep dependencies updated, check for vulnerabilities

### Testing Guidelines

- Write tests for new functionality
- Maintain test coverage as code evolves
- Run tests before pushing changes
- Use descriptive test names that explain expected behavior

## Commands Reference

### Common Git Commands
```bash
# Check status
git status

# Stage changes
git add .

# Commit with message
git commit -m "Description of changes"

# Push to remote
git push -u origin <branch-name>

# Pull latest changes
git pull origin <branch-name>
```

### Project Setup (once dependencies are defined)
```bash
# Node.js
npm install
npm run dev
npm test

# Python
pip install -r requirements.txt
python app.py
pytest
```

## AI Assistant Notes

### When Working on This Repository

1. **Read before modifying:** Always read existing files before making changes
2. **Minimal changes:** Make only the changes requested, avoid over-engineering
3. **Security first:** Given the Kali/security focus, prioritize secure coding practices
4. **Document decisions:** Add comments for non-obvious implementation choices
5. **Test additions:** When adding features, consider how they should be tested

### Current State

- **Empty repository:** No existing code structure
- **Initial setup needed:** Project framework and dependencies need to be established
- **Documentation sparse:** README and other docs should be created as project develops

### Future Updates to This File

As the project develops, this CLAUDE.md should be updated with:

- [ ] Specific tech stack details once chosen
- [ ] Build and deployment commands
- [ ] Environment setup requirements
- [ ] API documentation references
- [ ] Database schema information
- [ ] Dependency management guidelines
- [ ] CI/CD pipeline details

---

*Last updated: 2026-01-25*
*This file should be updated as the project evolves.*
