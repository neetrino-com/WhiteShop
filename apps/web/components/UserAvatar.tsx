'use client';

/**
 * UserAvatar Component
 * 
 * Displays a user avatar with initials placeholder.
 * If avatarUrl is provided, shows the image, otherwise shows initials.
 * 
 * @param firstName - User's first name
 * @param lastName - User's last name
 * @param avatarUrl - Optional URL to user's avatar image
 * @param size - Size of the avatar (default: 'md')
 */
interface UserAvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function UserAvatar({ 
  firstName, 
  lastName, 
  avatarUrl, 
  size = 'md',
  className = '' 
}: UserAvatarProps) {
  // Generate initials from first and last name
  const getInitials = (): string => {
    const firstInitial = firstName?.charAt(0)?.toUpperCase() || '';
    const lastInitial = lastName?.charAt(0)?.toUpperCase() || '';
    
    if (firstInitial && lastInitial) {
      return `${firstInitial}${lastInitial}`;
    } else if (firstInitial) {
      return firstInitial;
    } else if (lastInitial) {
      return lastInitial;
    }
    return '?';
  };

  // Size classes
  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-16 h-16 text-lg',
    lg: 'w-24 h-24 text-2xl',
    xl: 'w-32 h-32 text-3xl',
  };

  const initials = getInitials();

  return (
    <div className={`relative flex-shrink-0 ${sizeClasses[size]} ${className}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`${firstName || ''} ${lastName || ''}`.trim() || 'User avatar'}
          className="w-full h-full rounded-full object-cover border-2 border-gray-200"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-semibold border-2 border-gray-200 shadow-sm">
          {initials}
        </div>
      )}
    </div>
  );
}



