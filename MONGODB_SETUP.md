# Fix MongoDB Connection

The error `ENOTFOUND _mongodb._tcp.cluster.mongodb.net` means your connection string has an invalid hostname.

## Get your real connection string

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Sign in and select your project
3. Click **Database** → **Connect** on your cluster
4. Choose **Drivers** (or **Connect your application**)
5. Copy the connection string – it looks like:
   ```
   mongodb+srv://USERNAME:PASSWORD@cluster0.XXXXX.mongodb.net/expenses?retryWrites=true&w=majority
   ```
6. Replace `cluster.mongodb.net` in your `.env.local` with the hostname from that string (e.g. `cluster0.abc12.mongodb.net`)
7. Replace `user` and `password` with your actual Atlas username and password
8. Restart: `npm run dev`

## Example

**Wrong (placeholder):**
```
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/expenses
```

**Correct (from Atlas):**
```
MONGODB_URI=mongodb+srv://myuser:mypass@cluster0.abc12.mongodb.net/expenses?retryWrites=true&w=majority
```
