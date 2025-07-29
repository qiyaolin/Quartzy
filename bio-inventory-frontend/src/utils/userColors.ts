// User color assignment utility
// Manages color assignments for user avatars across desktop and mobile interfaces

interface UserColorState {
  activeColors: Map<string, string>;
  availableColors: string[];
  deactivatedUsers: Set<string>;
}

// Available color combinations for user avatars
const AVATAR_COLORS = [
  'from-blue-400 to-blue-600',
  'from-green-400 to-green-600', 
  'from-purple-400 to-purple-600',
  'from-pink-400 to-pink-600',
  'from-indigo-400 to-indigo-600',
  'from-red-400 to-red-600',
  'from-yellow-400 to-yellow-600',
  'from-teal-400 to-teal-600',
  'from-orange-400 to-orange-600',
  'from-cyan-400 to-cyan-600',
  'from-emerald-400 to-emerald-600',
  'from-violet-400 to-violet-600',
  'from-rose-400 to-rose-600',
  'from-amber-400 to-amber-600',
  'from-lime-400 to-lime-600'
];

// State management for user colors
let colorState: UserColorState = {
  activeColors: new Map(),
  availableColors: [...AVATAR_COLORS],
  deactivatedUsers: new Set()
};

/**
 * Get color for a user, assigning a new one if needed
 */
export const getUserColor = (username: string): string => {
  if (!username) return 'from-gray-400 to-gray-600';
  
  // Return existing color if user already has one
  if (colorState.activeColors.has(username)) {
    return colorState.activeColors.get(username)!;
  }
  
  // Assign new color
  let assignedColor: string;
  
  if (colorState.availableColors.length > 0) {
    // Use next available color
    assignedColor = colorState.availableColors.shift()!;
  } else {
    // All colors used, cycle back to first color
    assignedColor = AVATAR_COLORS[colorState.activeColors.size % AVATAR_COLORS.length];
  }
  
  colorState.activeColors.set(username, assignedColor);
  return assignedColor;
};

/**
 * Release color when user is deactivated
 */
export const releaseUserColor = (username: string): void => {
  if (!username) return;
  
  const userColor = colorState.activeColors.get(username);
  if (userColor) {
    // Remove from active colors
    colorState.activeColors.delete(username);
    
    // Add back to available colors if not already there
    if (!colorState.availableColors.includes(userColor)) {
      colorState.availableColors.unshift(userColor); // Add to front for immediate reuse
    }
    
    // Track deactivated user
    colorState.deactivatedUsers.add(username);
  }
};

/**
 * Reactivate user and assign color
 */
export const reactivateUser = (username: string): string => {
  if (!username) return 'from-gray-400 to-gray-600';
  
  // Remove from deactivated set
  colorState.deactivatedUsers.delete(username);
  
  // Get color (will assign new one if needed)
  return getUserColor(username);
};

/**
 * Check if user is deactivated
 */
export const isUserDeactivated = (username: string): boolean => {
  return colorState.deactivatedUsers.has(username);
};

/**
 * Get all active color assignments (for debugging)
 */
export const getActiveColorAssignments = (): Map<string, string> => {
  return new Map(colorState.activeColors);
};

/**
 * Reset all color assignments (for testing/debugging)
 */
export const resetColorAssignments = (): void => {
  colorState = {
    activeColors: new Map(),
    availableColors: [...AVATAR_COLORS],
    deactivatedUsers: new Set()
  };
};

/**
 * Get user initials for avatar display
 */
export const getUserInitials = (username: string): string => {
  if (!username) return '?';
  
  if (username.includes(' ')) {
    // Handle full names (first + last name)
    const parts = username.trim().split(' ');
    return (parts[0]?.charAt(0) + parts[parts.length - 1]?.charAt(0)).toUpperCase();
  } else {
    // Handle usernames or single names
    return username.charAt(0).toUpperCase();
  }
};

/**
 * Create avatar component props
 */
export const getAvatarProps = (username: string) => {
  return {
    color: getUserColor(username),
    initials: getUserInitials(username),
    isDeactivated: isUserDeactivated(username)
  };
};