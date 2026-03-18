# Authentication & Admin Setup

## New: Username + Password

The app now uses **username and password** for login.

### First-time setup
1. Go to the app (or `/select-user`)
2. Click **Register**
3. Enter username, password (min 6 chars), and optional display name
4. The first user is automatically an **admin**

### Existing users (migration)
If you had an account before (name only, no password):
1. Go to **Register**
2. Enter your **existing username** and a new password
3. Your account will be updated with the password

### Login
- **Switch User** in the header → takes you to login
- Enter username and password to sign in

## Admin Panel

- **Admin** appears in the menu (⋮) only for admin users
- Configure **App Mode**: Expenses | Workers | Stock
- Toggle **Features**: Expenses tracking, Worker history, Stock management

### App Modes
- **Expenses**: Groceries, bills, daily life expenses
- **Workers**: Worker details, cash given
- **Stock**: Godown/stock (coming soon)

## Database Collections

- `users` - userId, username, name, passwordHash, isAdmin
- `sessions` - token, userId (for auth)
- `config` - businessId, config (appMode, features)
