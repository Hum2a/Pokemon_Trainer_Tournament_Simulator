# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do not** open a public issue for security vulnerabilities.
2. Email the maintainer or open a private security advisory on GitHub.
3. Include a clear description of the vulnerability, steps to reproduce, and potential impact.
4. Allow reasonable time for a fix before public disclosure.

We appreciate your efforts to responsibly disclose your findings and will make every effort to acknowledge your contributions.

## Security Considerations

- **Path traversal**: All file paths are validated via `src/security.py`. Do not bypass these checks.
- **Config validation**: Use `validate_config()` before saving user-provided config.
- **Subprocess execution**: Scripts run from `Data/` with controlled inputs. Avoid exposing arbitrary command execution.
- **Secrets**: Never commit API keys, tokens, or credentials. Use environment variables for sensitive config.
