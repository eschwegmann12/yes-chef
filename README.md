# Yes, Chef

A meal planner you can put on your phone's home screen. You pick dinners for the week, and it builds the grocery list for you.

- **Recipes are shared.** Anyone with an account can add, edit and use them.
- **Each person has their own plan and grocery list.**
- **It works offline.** Changes sync when you're back online.

## One-time setup (about 15 minutes, on a computer)

### 1. Supabase (the database)
1. Go to supabase.com, sign up, and create a **New project**. Any name and region is fine. Save the database password somewhere.
2. Open **SQL Editor** and paste in all of `setup.sql`. Click **Run**. This creates the tables, the security rules and 18 starter recipes.
3. Go to **Authentication → Sign In / Providers → Email** and turn **off** "Confirm email", then save. **This one is required:** the app signs in with usernames, not real email addresses, so there's no email to confirm.
4. Click **Connect** (or go to **Project Settings → API**). Copy the **Project URL** and the **publishable key** (or the "anon public" key).

### 2. Add your keys
Open `config.js` and paste in those two values. Both are safe to make public. Your data is protected by the sign-in and the database rules.

### 3. GitHub Pages (hosting)
1. On github.com, create a **new public repository**, for example `dinner-plan`.
2. Click **uploading an existing file** and drag in **everything in this folder**, including the `icons` and `vendor` folders. Then click **Commit**.
3. Go to **Settings → Pages**. Under "Branch," choose `main` and `/ (root)`, then **Save**.
4. After a minute or two, your app will be live at `https://YOUR-USERNAME.github.io/dinner-plan/`.

### 4. Make accounts, then lock the door
1. Open the link, tap **Create an account**, and sign up. Then have him do the same.
2. Back in Supabase, go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up". Now nobody else can make an account.

### 5. Install on a phone
- **iPhone:** open the link in **Safari**, tap **Share**, then **Add to Home Screen**.
- **Android:** open it in **Chrome** and tap **Install** (or ⋮ → **Add to Home screen**).

## Adding recipes
- **In the app:** tap **+ Add recipe**. Paste the ingredients one per line, straight from any recipe website. The app shows which aisle each item will go in, and you can fix any that are wrong.
- **Lots at once:** fill in `recipe-template.csv` in Excel or Google Sheets, one recipe per row. Put ingredients and steps on separate lines inside the cell (Alt+Enter in Excel), or separate them with semicolons. Save it as **CSV**, then in the app tap **+ Add recipe → Import CSV**.

## Good to know
- Free Supabase projects pause after about a week with no activity. If the app stops loading recipes, open your Supabase dashboard and click **Restore project**.
- To change the app later, edit the files on GitHub. Phones pick up the new version the next time they open the app online.

## Usernames and passwords
- You sign in with a **username** and password, not an email.
- Behind the scenes, Supabase stores each username as `username@yes-chef.example`. That's a placeholder address and no email is ever sent to it. You'll see these in Supabase under **Authentication → Users**.
- To add someone yourself while sign-ups are off: in **Authentication → Users**, click **Add user → Create new user**, enter `theirusername@yes-chef.example` and a password, and check **Auto confirm**.
- **Forgot a password?** There's no "reset by email." Open **SQL Editor** in Supabase and run this, changing the two values:

```
update auth.users
set encrypted_password = crypt('NEW-PASSWORD', gen_salt('bf'))
where email = 'USERNAME@yes-chef.example';
```
