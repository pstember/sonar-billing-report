# Security Guidelines

## Token Management

**Using the app:** The app asks for your SonarCloud token on the welcome screen and stores it in the browser (IndexedDB). No `.env` file is required to run the app.

**Running test scripts:** If you run `node test-api.js` or `node test-e2e.js` from the command line, you can put the token in a `.env` file (or pass it as an argument) so you don't have to type it each time. The app itself never reads `.env`.

### ✅ DO

1. **For test scripts only: store token in `.env`**
   ```bash
   cp .env.example .env
   # Edit .env and add your token (only needed for test-api.js / test-e2e.js)
   ```

2. **Verify `.env` is in `.gitignore`**
   ```bash
   cat .gitignore | grep .env
   # Should output: .env
   ```

3. **Use environment variables in tests**
   ```bash
   # Token is read from .env automatically
   node test-api.js

   # Or pass as argument (for CI/CD)
   node test-api.js $SONAR_TOKEN
   ```

4. **Share `.env.example` with team**
   - Commit `.env.example` as a template
   - Never commit actual `.env` file

### ❌ DON'T

1. **Never hardcode tokens in source code**
   ```javascript
   // ❌ BAD
   const token = 'abc123...';

   // ✅ GOOD
   const token = process.env.SONAR_TOKEN;
   ```

2. **Never commit `.env` to git**
   ```bash
   # Check what would be committed
   git status

   # If .env appears, add to .gitignore
   echo ".env" >> .gitignore
   ```

3. **Never share tokens in documentation**
   - Use placeholders: `your_token_here`
   - Reference environment variables instead

4. **Never log tokens in console**
   ```javascript
   // ❌ BAD
   console.log('Token:', token);

   // ✅ GOOD
   console.log('Token:', token.substring(0, 10) + '...');
   ```

## File Security Status

### ✅ Secure Files (Committed)
- `.env.example` - Template file (no secrets)
- `.gitignore` - Contains `.env` exclusion
- `test-api.js` - Reads from environment
- `test-e2e.js` - Reads from environment
- All documentation - No hardcoded secrets

### 🔒 Secret Files (NOT Committed)
- `.env` - Contains actual token
- Any backup files with tokens

## Token Permissions

### SonarCloud Token Requirements

Your token needs the following permissions:
- Read access to organizations
- Read access to projects
- Read access to measures/metrics
- Read access to portfolios

### Creating a Secure Token

1. Go to SonarCloud → My Account → Security
2. Click "Generate Token"
3. Name it descriptively (e.g., "Billing Report - Production")
4. Set expiration date (recommended: 90 days)
5. Select minimum required permissions
6. Copy token immediately (shown only once)
7. Store in `.env` file

### Token Rotation

Recommended practice:
- Rotate tokens every 90 days
- Use different tokens for dev/staging/prod
- Revoke tokens when no longer needed
- Monitor token usage in SonarCloud

## CI/CD Best Practices

### GitHub Actions
```yaml
# .github/workflows/test.yml
env:
  SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install
      - run: node test-api.js
```

### GitLab CI
```yaml
# .gitlab-ci.yml
variables:
  SONAR_TOKEN: $SONAR_TOKEN

test:
  script:
    - npm install
    - node test-api.js
```

## Incident Response

### If Token is Compromised

1. **Immediately revoke the token**
   - SonarCloud → My Account → Security → Revoke

2. **Generate a new token**
   - Follow token creation process above

3. **Update `.env` file**
   ```bash
   # Update with new token
   vim .env
   ```

4. **Check git history**
   ```bash
   # Search for accidentally committed tokens
   git log -p | grep -i "token"
   ```

5. **If found in git history**
   ```bash
   # Remove from git history (use with caution)
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   ```

## Security Checklist

Before committing code:
- [ ] No hardcoded tokens in source files
- [ ] `.env` is in `.gitignore`
- [ ] Actual `.env` file is not staged for commit
- [ ] `.env.example` has placeholder values only
- [ ] Test scripts use environment variables
- [ ] No tokens in documentation
- [ ] Token logging is masked/truncated

Before sharing project:
- [ ] Remove `.env` file
- [ ] Verify `.env.example` has no secrets
- [ ] Include setup instructions for `.env`
- [ ] Document required token permissions

## Additional Resources

- [SonarCloud Security Best Practices](https://docs.sonarcloud.io/advanced-setup/security/)
- [Git Secrets Prevention](https://git-secret.io/)
- [Environment Variable Management](https://12factor.net/config)

---

*Security is everyone's responsibility. When in doubt, don't commit it.*
