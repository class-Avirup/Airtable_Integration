import { NavLink } from "react-router-dom"

const Navbar = () => {
  // In a real app, the userId would come from a user context
  const userId = "test_user_123"

  // Function to determine link classes based on active state
  const getLinkClassName = ({ isActive }) => {
    const baseClasses = "font-medium transition-colors duration-200"
    if (isActive) {
      return `${baseClasses} text-blue-600`
    }
    return `${baseClasses} text-gray-600 hover:text-blue-600`
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 mb-8">
      <div className="flex items-center justify-between h-16">
        {/* Brand/Logo */}
        <div className="flex-shrink-0">
          <NavLink to="/" className="text-2xl font-bold text-gray-800">
            AirtableForms
          </NavLink>
        </div>

        {/* Navigation Links */}
        <div className="flex items-center space-x-8">
          <NavLink to={`/dashboard?user_id=${userId}`} className={getLinkClassName}>
            Dashboard
          </NavLink>
          <NavLink to={`/builder?user_id=${userId}`} className={getLinkClassName}>
            Builder
          </NavLink>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
