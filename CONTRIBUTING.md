# Contributing to Mari8X Community Edition

Thank you for your interest in contributing! 🎉

## 🤝 How to Contribute

### 1. **Code Contributions**

**Process:**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Guidelines:**
- Follow existing code style (TypeScript + ES modules)
- Add tests for new features
- Update documentation
- Keep PRs focused (one feature per PR)
- Write clear commit messages

### 2. **Data Contributions**

Help improve the platform by contributing:
- **Port data:** Tariffs, restrictions, operating hours
- **Vessel sightings:** Photos, observations
- **Bunker prices:** Current fuel prices at ports
- **Route data:** Actual vessel tracks

**Submit via:**
- GraphQL mutation (if you have API access)
- GitHub Issue with data
- Discord #data-contributions channel

**Rewards:**
- 10 contributions → Bronze (500 API calls/day)
- 50 contributions → Silver (2,000 API calls/day)
- 200 contributions → Gold (10,000 API calls/day)

### 3. **Documentation**

We welcome:
- Tutorials and guides
- API examples
- Translation to other languages
- Typo fixes and clarifications

### 4. **Bug Reports**

**Before submitting:**
- Check if the issue already exists
- Test with the latest version
- Include reproduction steps

**Template:**
```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g. Ubuntu 22.04]
- Docker version: [e.g. 24.0.5]
- Mari8X version: [e.g. 1.0.0]
```

### 5. **Feature Requests**

Open a [GitHub Discussion](https://github.com/your-org/mari8x-community/discussions) with:
- **Use case:** What problem does this solve?
- **Proposed solution:** How should it work?
- **Alternatives considered:** Other approaches you thought about

## 🏗️ Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/mari8x-community.git
cd mari8x-community

# Install dependencies
cd backend
npm install

# Setup database
docker-compose up -d postgres
npx prisma migrate dev

# Start dev server
npm run dev

# In another terminal, start frontend
cd ../frontend
npm install
npm run dev
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## 📝 Code Style

- **TypeScript:** Strict mode enabled
- **Formatting:** Prettier (2 spaces, single quotes)
- **Linting:** ESLint with recommended rules
- **Naming:**
  - camelCase for variables and functions
  - PascalCase for classes and types
  - UPPER_SNAKE_CASE for constants

## 🔒 Security

**Reporting vulnerabilities:**
- **DO NOT** open a public issue
- Email: captain@mari8X.com
- We'll respond within 48 hours

## 📜 License

By contributing, you agree that your contributions will be licensed under the AGPLv3 license.

## 🎖️ Recognition

Contributors are recognized in:
- README.md (top contributors)
- Release notes
- Community leaderboard
- Discord special role

## 📞 Questions?

- **Discord:** https://discord.gg/mari8x
- **Discussions:** https://github.com/your-org/mari8x-community/discussions
- **Email:** captain@mari8X.com

---

**Thank you for making Mari8X better!** 🚢
