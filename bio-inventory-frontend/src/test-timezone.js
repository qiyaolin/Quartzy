// Simple test to verify timezone module can be imported
try {
  const timezone = require('./utils/timezone.ts');
  console.log('Timezone module loaded successfully');
} catch (error) {
  console.error('Error loading timezone module:', error.message);
}