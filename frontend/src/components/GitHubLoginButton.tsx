// GitHubLoginButton component
import { Github } from 'lucide-react';


interface GitHubLoginButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  isLoggingIn?: boolean;
}

export default function GitHubLoginButton({ onClick, disabled, isLoggingIn }: GitHubLoginButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      type="button"
      className="inline-flex items-center gap-2 bg-white text-black px-4 py-2 rounded text-xs font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50"
    >
      <Github className="w-4 h-4" />
      {isLoggingIn ? 'Connecting...' : 'Connect GitHub'}
    </button>
  );
}
