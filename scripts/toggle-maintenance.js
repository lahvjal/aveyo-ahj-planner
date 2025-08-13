#!/usr/bin/env node

/**
 * Maintenance Mode Toggle Script
 * 
 * This script allows you to easily toggle maintenance mode on/off
 * Usage: node scripts/toggle-maintenance.js [on|off|status]
 */

const fs = require('fs');
const path = require('path');

const MAINTENANCE_FILE = path.join(__dirname, '../src/utils/maintenance.ts');

function getCurrentStatus() {
  try {
    const content = fs.readFileSync(MAINTENANCE_FILE, 'utf8');
    const match = content.match(/export const MAINTENANCE_MODE = (true|false);/);
    return match ? match[1] === 'true' : false;
  } catch (error) {
    console.error('Error reading maintenance file:', error.message);
    return false;
  }
}

function setMaintenanceMode(enabled) {
  try {
    let content = fs.readFileSync(MAINTENANCE_FILE, 'utf8');
    
    // Replace the MAINTENANCE_MODE value
    content = content.replace(
      /export const MAINTENANCE_MODE = (true|false);/,
      `export const MAINTENANCE_MODE = ${enabled};`
    );
    
    fs.writeFileSync(MAINTENANCE_FILE, content, 'utf8');
    return true;
  } catch (error) {
    console.error('Error updating maintenance file:', error.message);
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  switch (command) {
    case 'on':
    case 'enable':
      if (setMaintenanceMode(true)) {
        console.log('✅ Maintenance mode ENABLED');
        console.log('🚧 All users will now see the maintenance page');
      } else {
        console.log('❌ Failed to enable maintenance mode');
        process.exit(1);
      }
      break;

    case 'off':
    case 'disable':
      if (setMaintenanceMode(false)) {
        console.log('✅ Maintenance mode DISABLED');
        console.log('🟢 Users can now access the application normally');
      } else {
        console.log('❌ Failed to disable maintenance mode');
        process.exit(1);
      }
      break;

    case 'status':
    default:
      const isEnabled = getCurrentStatus();
      console.log(`Maintenance mode is currently: ${isEnabled ? '🚧 ENABLED' : '🟢 DISABLED'}`);
      
      if (command && command !== 'status') {
        console.log('\nUsage: node scripts/toggle-maintenance.js [on|off|status]');
        console.log('  on/enable  - Enable maintenance mode');
        console.log('  off/disable - Disable maintenance mode');
        console.log('  status     - Show current status (default)');
      }
      break;
  }
}

main();
