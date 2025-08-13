# Maintenance Mode Documentation

This application includes a comprehensive maintenance mode system that allows you to block all user access while performing updates or maintenance.

## Quick Start

### Enable Maintenance Mode
```bash
npm run maintenance:on
```

### Disable Maintenance Mode
```bash
npm run maintenance:off
```

### Check Status
```bash
npm run maintenance:status
```

## How It Works

The maintenance system consists of several components:

1. **Configuration File** (`src/utils/maintenance.ts`)
   - Central control for maintenance mode
   - Set `MAINTENANCE_MODE = true` to enable
   - Configure messages and contact information

2. **Middleware Integration** (`src/middleware.ts`)
   - Intercepts all requests when maintenance mode is active
   - Redirects users to the maintenance page
   - Allows bypass for specific IP addresses (if configured)

3. **Maintenance Page** (`src/app/maintenance/page.tsx`)
   - Professional maintenance screen shown to users
   - Includes company branding and contact information
   - "Check Again" button for users to retry access

4. **Toggle Scripts** (`scripts/toggle-maintenance.js`)
   - Easy command-line control
   - Automatically updates the configuration file

## Manual Control

You can also manually enable/disable maintenance mode by editing the configuration file:

```typescript
// src/utils/maintenance.ts
export const MAINTENANCE_MODE = true; // Set to false to disable
```

## IP Bypass (Optional)

To allow specific IP addresses to bypass maintenance mode:

```typescript
// src/utils/maintenance.ts
export const MAINTENANCE_CONFIG = {
  // ... other config
  bypassIPs: ["192.168.1.100", "10.0.0.1"] // Add your IP addresses
};
```

## Customization

### Update Messages
Edit the `MAINTENANCE_CONFIG` object in `src/utils/maintenance.ts`:

```typescript
export const MAINTENANCE_CONFIG = {
  title: "Custom Maintenance Title",
  message: "Your custom maintenance message",
  estimatedDuration: "Expected completion time",
  contactEmail: "your-support@email.com"
};
```

### Styling
The maintenance page component is located at `src/components/MaintenancePage.tsx` and uses Tailwind CSS for styling.

## Important Notes

- **Maintenance mode is currently ENABLED** by default
- All users (except bypassed IPs) will see the maintenance page
- The maintenance page is accessible at `/maintenance`
- Middleware processes maintenance checks before authentication
- Changes to `maintenance.ts` require a server restart in development

## Production Deployment

When deploying to production with maintenance mode enabled:

1. The maintenance page will be shown to all users
2. You can disable it remotely by updating the configuration file
3. Consider using environment variables for production control if needed

## Troubleshooting

- If maintenance mode isn't working, check the middleware configuration
- Ensure the maintenance route is not excluded from middleware processing
- Check browser console for any JavaScript errors
- Verify the maintenance page renders correctly at `/maintenance`
