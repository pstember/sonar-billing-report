# Changelog

## March 2026

- **API page size** – SonarCloud API enforces max 100 items per page; app uses `src/constants/api.ts` and [API_LIMITS.md](./API_LIMITS.md).
- **Brand** – UI updated to Sonar brand guidelines (colors, Poppins/Inter, design patterns). See [BRAND_IMPLEMENTATION.md](./BRAND_IMPLEMENTATION.md).
- **Organizations endpoint** – Fixed to send required `member=true` parameter; all 7 API endpoints verified. See [VERIFICATION_REPORT.md](./VERIFICATION_REPORT.md).
- **Development guidelines** – [CLAUDE.md](./CLAUDE.md) added for brand, API limits, security, and code standards.
