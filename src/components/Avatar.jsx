import React from 'react';
import { User } from 'lucide-react';

const Avatar = ({ 
  photoURL, 
  displayName, 
  size = 'md',
  className = '' 
}) => {
  const sizeClasses = {
    xs: 'w-5 h-5',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  };

  const iconSizes = {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 48,
    xl: 64
  };

  const defaultPhotoURL = '/person.svg';
  const imageURL = photoURL || defaultPhotoURL;

  return (
    <img
      src={imageURL}
      alt={displayName || 'User'}
      className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
    />
  );
};

export default Avatar;
