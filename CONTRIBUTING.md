# 🤝 Contributing to Tshong AI

Thank you for your interest in contributing to Tshong AI! This document provides guidelines and information for contributors.

## 📋 **Table of Contents**

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Submitting Changes](#submitting-changes)

## 📜 **Code of Conduct**

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). We are committed to providing a welcoming and inclusive environment for all contributors.

## 🚀 **Getting Started**

### **Prerequisites**
- Node.js 18+
- Git
- AWS CLI (for testing)
- Google Cloud SDK (for Vision API testing)

### **Setup Development Environment**

```bash
# Fork the repository
# Clone your fork
git clone https://github.com/your-username/Image-recognition-System.git
cd Image-recognition-System

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev
```

### **Environment Variables for Development**

Create a `.env` file with the following variables:

```bash
# Development mode
NODE_ENV=development

# AWS Configuration (use test credentials)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_test_access_key
AWS_SECRET_ACCESS_KEY=your_test_secret_key
AWS_BUCKET_NAME=your-test-bucket

# Google Cloud Vision (use test API key)
GOOGLE_CLOUD_VISION_API_KEY=your_test_vision_api_key

# Google Sheets (use test service account)
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}

# Test customer IDs
GOOGLE_SHEETS_SPREADSHEET_TEST_ID=your_test_spreadsheet_id
```

## 🔄 **Development Workflow**

### **1. Create a Feature Branch**

```bash
# Update your fork
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/your-feature-name
```

### **2. Make Your Changes**

- Write clean, readable code
- Add tests for new functionality
- Update documentation
- Follow the coding standards below

### **3. Test Your Changes**

```bash
# Run linting
npm run lint

# Run tests
npm test

# Run integration tests
npm run test:integration

# Build the project
npm run build
```

### **4. Commit Your Changes**

```bash
# Stage changes
git add .

# Commit with conventional commit message
git commit -m "feat: add new bank recognition support

- Add support for Bank XYZ
- Implement new OCR patterns
- Add unit tests for new functionality
- Update documentation"
```

### **5. Push and Create Pull Request**

```bash
# Push to your fork
git push origin feature/your-feature-name

# Create Pull Request on GitHub
```

## 📝 **Code Standards**

### **JavaScript/Node.js Standards**

- Use ES6+ features
- Follow ESLint configuration
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused

### **Example Code Style**

```javascript
/**
 * Processes receipt data and extracts relevant information
 * @param {string} text - Raw OCR text from receipt
 * @param {string} bankKey - Identified bank type
 * @returns {Object} Extracted receipt data
 */
export function parseReceiptData(text, bankKey) {
    // Validate inputs
    if (!text || typeof text !== 'string') {
        throw new Error('Invalid text input');
    }

    // Process data
    const result = {
        amount: null,
        reference: null,
        date: null,
        bank: bankKey
    };

    // Extract data based on bank type
    switch (bankKey) {
        case 'BNB':
            result.amount = extractBNBAmount(text);
            result.reference = extractBNBReference(text);
            break;
        // ... other cases
    }

    return result;
}
```

### **CSS Standards**

- Use BEM methodology for class names
- Keep styles modular and reusable
- Use CSS custom properties for theming
- Ensure responsive design

### **HTML Standards**

- Use semantic HTML elements
- Ensure accessibility (ARIA labels, alt text)
- Keep markup clean and minimal

## 🧪 **Testing**

### **Unit Tests**

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --grep "receipt parsing"
```

### **Integration Tests**

```bash
# Run integration tests
npm run test:integration

# Test API endpoints
npm run test:api
```

### **Manual Testing**

- Test on different devices and browsers
- Test with various receipt formats
- Verify AWS S3 integration
- Test Google Sheets synchronization

### **Test Structure**

```javascript
// Example test file: tests/vision-api.test.js
import { describe, it, expect, beforeEach } from 'jest';
import { parseReceiptData } from '../server.js';

describe('Vision API', () => {
    beforeEach(() => {
        // Setup test environment
    });

    describe('parseReceiptData', () => {
        it('should extract BNB receipt data correctly', () => {
            const mockText = 'BNB Transaction Successful\nAmount: Nu. 1500.00\nRRN: 123456789012';
            const result = parseReceiptData(mockText, 'BNB');
            
            expect(result.amount).toBe('1500.00');
            expect(result.reference).toBe('123456789012');
            expect(result.bank).toBe('BNB');
        });

        it('should handle invalid input gracefully', () => {
            expect(() => parseReceiptData(null, 'BNB')).toThrow('Invalid text input');
        });
    });
});
```

## 📚 **Documentation**

### **Code Documentation**

- Add JSDoc comments for all public functions
- Include examples in documentation
- Document API endpoints with OpenAPI/Swagger
- Keep README updated with new features

### **API Documentation**

```javascript
/**
 * @api {post} /vision-api Process single receipt
 * @apiName ProcessReceipt
 * @apiGroup Receipt
 * @apiVersion 1.0.0
 *
 * @apiParam {String} image Base64 encoded image
 * @apiParam {String} customerID Customer identifier
 *
 * @apiSuccess {String} amount Extracted amount
 * @apiSuccess {String} referenceNo Reference number
 * @apiSuccess {String} bank Bank type
 *
 * @apiError {String} error Error message
 */
```

## 📤 **Submitting Changes**

### **Pull Request Guidelines**

1. **Title**: Use conventional commit format
   - `feat: add new bank support`
   - `fix: resolve OCR accuracy issue`
   - `docs: update API documentation`

2. **Description**: Include:
   - What changes were made
   - Why changes were necessary
   - How to test the changes
   - Screenshots (if UI changes)

3. **Checklist**:
   - [ ] Code follows style guidelines
   - [ ] Tests pass
   - [ ] Documentation updated
   - [ ] No breaking changes (or documented)

### **Example Pull Request**

```markdown
## Description
Adds support for Bank XYZ receipt recognition with improved OCR accuracy.

## Changes
- Add new bank patterns in `BANK_KEYS` object
- Implement `extractXYZAmount()` function
- Add unit tests for new functionality
- Update API documentation

## Testing
- [x] Unit tests pass
- [x] Integration tests pass
- [x] Manual testing with sample receipts
- [x] Cross-browser testing

## Screenshots
![Bank XYZ Recognition](screenshots/xyz-recognition.png)

## Related Issues
Closes #123
```

## 🏷️ **Issue Labels**

- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Improvements to documentation
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention is needed
- `priority: high`: High priority issue
- `priority: low`: Low priority issue

## 🎯 **Areas for Contribution**

### **High Priority**
- [ ] Add support for more banks
- [ ] Improve OCR accuracy
- [ ] Add unit test coverage
- [ ] Performance optimizations

### **Medium Priority**
- [ ] UI/UX improvements
- [ ] Documentation updates
- [ ] Code refactoring
- [ ] Security enhancements

### **Low Priority**
- [ ] Additional language support
- [ ] Advanced analytics
- [ ] Mobile app development
- [ ] Third-party integrations

## 🆘 **Getting Help**

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Email**: keldendraduldorji@gmail.com
- **Slack**: Join our community workspace

## 🙏 **Recognition**

Contributors will be recognized in:
- Project README
- Release notes
- Contributor hall of fame
- Conference presentations

Thank you for contributing to Tshong AI! 🚀 