# Contributing to Quartzy

Thank you for your interest in contributing to Quartzy! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

### Reporting Issues

1. **Search existing issues** first to avoid duplicates
2. **Use issue templates** when available
3. **Provide detailed information**:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, browser, Python/Node versions)
   - Screenshots if applicable

### Suggesting Features

1. **Check the roadmap** and open issues first
2. **Create a feature request** issue with:
   - Clear use case description
   - Expected benefits
   - Potential implementation approach
   - Any alternative solutions considered

## 🚀 Development Setup

### Prerequisites

- Python 3.8+
- Node.js 16+
- Git
- PostgreSQL (optional, for production-like testing)

### Quick Start

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/your-username/quartzy.git
   cd quartzy
   ```

2. **Backend setup**:
   ```bash
   cd bio-inventory-backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env
   python manage.py migrate
   python manage.py createsuperuser
   python manage.py runserver
   ```

3. **Frontend setup** (in new terminal):
   ```bash
   cd bio-inventory-frontend
   npm install
   cp .env.example .env
   npm start
   ```

### Using Docker (Alternative)

```bash
docker-compose up --build
```

## 📝 Development Guidelines

### Code Style

#### Backend (Python/Django)
- Follow **PEP 8** style guide
- Use **Black** for formatting: `black .`
- Use **flake8** for linting: `flake8 .`
- Maximum line length: 88 characters
- Use type hints where appropriate

#### Frontend (TypeScript/React)
- Follow **Airbnb Style Guide**
- Use **Prettier** for formatting: `npm run format`
- Use **ESLint** for linting: `npm run lint`
- Prefer functional components with hooks
- Use TypeScript strict mode

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding missing tests
- `chore`: Changes to build process or auxiliary tools

Examples:
```
feat(inventory): add batch item import functionality

fix(auth): resolve token expiration handling

docs: update API documentation for requests endpoint

test(funding): add unit tests for budget calculations
```

### Branch Naming

- Feature branches: `feature/description-of-feature`
- Bug fixes: `fix/description-of-bug`
- Documentation: `docs/description-of-change`
- Hotfixes: `hotfix/description-of-fix`

## 🧪 Testing

### Backend Tests

```bash
cd bio-inventory-backend
python manage.py test
```

### Frontend Tests

```bash
cd bio-inventory-frontend
npm test
```

### Integration Tests

```bash
docker-compose up -d
# Run integration tests
docker-compose down
```

### Test Guidelines

- Write tests for new features
- Maintain or improve test coverage
- Use descriptive test names
- Group related tests in test classes
- Mock external dependencies

## 📋 Pull Request Process

1. **Create a feature branch** from `develop`
2. **Make your changes** following the guidelines above
3. **Add or update tests** as needed
4. **Update documentation** if necessary
5. **Ensure all tests pass** and linting is clean
6. **Create a pull request** with:
   - Clear title and description
   - Reference to related issues
   - Screenshots for UI changes
   - Testing instructions

### PR Review Process

- PRs require at least one approval
- All CI checks must pass
- Address reviewer feedback promptly
- Keep PR scope focused and manageable

## 🏗️ Architecture Guidelines

### Backend Architecture

- Follow Django best practices
- Use Django REST Framework viewsets
- Implement proper serializers
- Add appropriate permissions
- Write meaningful docstrings

### Frontend Architecture

- Use functional components with hooks
- Implement proper error boundaries
- Follow React best practices
- Use TypeScript interfaces for type safety
- Implement proper loading states

### Database Design

- Use meaningful model names
- Add proper indexes
- Include help_text in model fields
- Write migrations carefully
- Consider data integrity constraints

## 📚 Documentation

- Update README files for significant changes
- Add docstrings to new functions/classes
- Update API documentation
- Include inline comments for complex logic
- Update user guides if needed

## 🛡️ Security Guidelines

- Never commit secrets or passwords
- Use environment variables for configuration
- Validate all user inputs
- Implement proper authentication/authorization
- Follow OWASP security practices

## 🌟 Code Review Checklist

### General
- [ ] Code follows style guidelines
- [ ] No debug code or console.logs left
- [ ] Error handling is implemented
- [ ] Code is self-documenting or well-commented

### Backend
- [ ] Proper Django patterns used
- [ ] Database queries are optimized
- [ ] Proper permissions implemented
- [ ] API endpoints are RESTful

### Frontend
- [ ] Components are reusable and focused
- [ ] Props are properly typed
- [ ] Loading and error states handled
- [ ] Accessibility considerations included

## 🎯 Performance Guidelines

- Optimize database queries (use select_related, prefetch_related)
- Implement proper pagination
- Use React.memo for expensive components
- Optimize bundle size
- Consider lazy loading for routes

## 🐛 Debugging Tips

### Backend Debugging
- Use Django debug toolbar in development
- Check Django logs
- Use Python debugger (pdb)
- Verify database queries

### Frontend Debugging
- Use React Developer Tools
- Check browser console for errors
- Use browser network tab for API calls
- Verify component state and props

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and general discussion
- **Email**: For security-related issues

## 📄 License

By contributing to Quartzy, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

Thank you for contributing to Quartzy! 🧪✨