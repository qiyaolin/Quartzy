// User management utilities for handling user activation/deactivation
import { releaseUserColor, reactivateUser } from './userColors';

/**
 * Handle user deactivation - releases their color for reuse
 */
export const deactivateUser = (username: string): void => {
  if (!username) return;
  
  console.log(`Deactivating user: ${username}`);
  releaseUserColor(username);
  
  // You can add additional deactivation logic here
  // For example, updating UI state, clearing caches, etc.
};

/**
 * Handle user reactivation - assigns them a new color
 */
export const activateUser = (username: string): void => {
  if (!username) return;
  
  console.log(`Reactivating user: ${username}`);
  const newColor = reactivateUser(username);
  
  console.log(`User ${username} assigned color: ${newColor}`);
  
  // You can add additional reactivation logic here
  // For example, updating UI state, refetching data, etc.
};

/**
 * Batch deactivate multiple users
 */
export const batchDeactivateUsers = (usernames: string[]): void => {
  usernames.forEach(username => deactivateUser(username));
  console.log(`Batch deactivated ${usernames.length} users`);
};

/**
 * Batch reactivate multiple users
 */
export const batchActivateUsers = (usernames: string[]): void => {
  usernames.forEach(username => activateUser(username));
  console.log(`Batch reactivated ${usernames.length} users`);
};

/**
 * Handle user status change from API response
 */
export const handleUserStatusChange = (username: string, isActive: boolean): void => {
  if (isActive) {
    activateUser(username);
  } else {
    deactivateUser(username);
  }
};