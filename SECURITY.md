# Security Policy

## Reporting

Report security issues privately:

- Security contact: https://t.me/Jepeta_bot
- Policy: https://jepeta.dev/contact.html#security
- Canonical security.txt: https://jepeta.dev/.well-known/security.txt

Do not post sensitive authentication material or confidential implementation details in public issues.

## Public repository boundary

This repository contains intentionally public contracts, documentation, samples, integration examples, and boundary QA only.

Production implementation, privileged configuration, settlement logic, private operational state, and infrastructure are intentionally excluded.

Release flow is one-way only:

`private production source -> reviewed/sanitized public artifacts -> public repository`

The public repository is never an upstream source for private or production state.
