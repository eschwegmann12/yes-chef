-- Yes, Chef: database setup
-- Paste this whole file into Supabase > SQL Editor and click Run. Safe to run more than once.

-- Recipes: shared by everyone who has an account
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  minutes int,
  servings int not null default 2,
  tags text not null default '',
  ingredients text not null default '',
  steps text not null default '',
  added_by uuid default auth.uid() references auth.users on delete set null,
  added_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Plans: each person's own week + grocery list
create table if not exists public.plans (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.recipes enable row level security;
alter table public.plans enable row level security;

grant select, insert, update, delete on public.recipes to authenticated;
grant select, insert, update on public.plans to authenticated;

drop policy if exists "signed-in people read recipes" on public.recipes;
drop policy if exists "signed-in people add recipes" on public.recipes;
drop policy if exists "signed-in people edit recipes" on public.recipes;
drop policy if exists "signed-in people delete recipes" on public.recipes;
create policy "signed-in people read recipes" on public.recipes for select to authenticated using (true);
create policy "signed-in people add recipes" on public.recipes for insert to authenticated with check (true);
create policy "signed-in people edit recipes" on public.recipes for update to authenticated using (true) with check (true);
create policy "signed-in people delete recipes" on public.recipes for delete to authenticated using (true);

drop policy if exists "read own plan" on public.plans;
drop policy if exists "create own plan" on public.plans;
drop policy if exists "update own plan" on public.plans;
create policy "read own plan" on public.plans for select to authenticated using (user_id = auth.uid());
create policy "create own plan" on public.plans for insert to authenticated with check (user_id = auth.uid());
create policy "update own plan" on public.plans for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Starter recipes (only added if the recipes table is empty)
do $seed$
begin
  if not exists (select 1 from public.recipes) then
    insert into public.recipes (name, minutes, servings, tags, ingredients, steps, added_by_name) values
      ($q$Lemon Garlic Chicken Orzo$q$, 30, 2, $q$$q$,
       $q$¾ lb chicken breast
¾ cup orzo
1½ cups chicken broth
3 cloves garlic
1 lemon
2 cups baby spinach
¼ cup parmesan
1 tbsp olive oil$q$,
       $q$Cut chicken into bite-size pieces; season with salt and pepper.
Sear chicken in the oil over medium-high heat, 5–6 min, then set aside.
Sauté garlic 30 sec, add orzo and broth. Simmer 10 min, stirring often.
Stir in spinach, lemon zest and juice, parmesan and the chicken until the spinach wilts.$q$, 'Yes, Chef'),
      ($q$Sheet-Pan Sausage & Peppers$q$, 30, 2, $q$Low-carb$q$,
       $q$½ lb smoked sausage
2 bell peppers
1 red onion
1 tbsp olive oil
1 tsp italian seasoning
2 tbsp grainy mustard$q$,
       $q$Heat oven to 425°F.
Slice sausage, peppers and onion; toss with oil, seasoning, salt and pepper on a sheet pan.
Roast 20–22 min, tossing halfway, until the edges char.
Serve with mustard for dipping.$q$, 'Yes, Chef'),
      ($q$Beef & Broccoli Stir-Fry$q$, 25, 2, $q$$q$,
       $q$¾ lb flank steak
2 broccoli crowns
¾ cup jasmine rice
3 tbsp soy sauce
1 tbsp brown sugar
1 tsp cornstarch
2 cloves garlic
1 tbsp fresh ginger
1 tbsp vegetable oil$q$,
       $q$Cook rice per package.
Thinly slice steak against the grain; toss with 1 tbsp soy sauce and the cornstarch.
Whisk remaining soy sauce, sugar, grated ginger, garlic and ¼ cup water.
Sear beef in hot oil 2 min; remove. Stir-fry broccoli 4 min with a splash of water.
Return beef, add sauce, toss 1 min until glossy. Serve over rice.$q$, 'Yes, Chef'),
      ($q$Black Bean Tacos with Lime Slaw$q$, 20, 2, $q$Vegetarian$q$,
       $q$1 can black beans
6 corn tortillas
2 cups shredded cabbage
1 lime
1 avocado
¼ cup sour cream
1 tsp cumin
¼ cup cotija cheese
¼ cup cilantro$q$,
       $q$Warm beans with cumin, salt and a splash of water; mash lightly.
Toss cabbage with lime juice, chopped cilantro and a pinch of salt.
Char tortillas in a dry skillet.
Fill with beans, slaw, sliced avocado, sour cream and cotija.$q$, 'Yes, Chef'),
      ($q$Creamy Tuscan Salmon$q$, 25, 2, $q$Seafood, Low-carb$q$,
       $q$2 salmon fillets
½ cup heavy cream
¼ cup sun-dried tomatoes
2 cups baby spinach
2 cloves garlic
¼ cup parmesan
1 tbsp butter$q$,
       $q$Pat salmon dry; season with salt and pepper.
Sear in butter 4 min per side; set aside.
Sauté garlic and chopped sun-dried tomatoes 1 min. Add cream and parmesan; simmer 2 min.
Wilt in spinach, return salmon and spoon the sauce over.$q$, 'Yes, Chef'),
      ($q$Chicken Burrito Bowls$q$, 30, 2, $q$$q$,
       $q$¾ lb chicken thighs
¾ cup jasmine rice
1 can black beans
1 cup frozen corn
½ cup salsa
1 lime
1 avocado
2 tsp taco seasoning
½ cup shredded cheddar$q$,
       $q$Cook rice; stir in lime zest and juice.
Season chicken with taco seasoning; cook in a skillet 6–7 min per side, then slice.
Warm beans and corn together in the same pan.
Build bowls: rice, beans and corn, chicken, salsa, avocado and cheese.$q$, 'Yes, Chef'),
      ($q$Pesto Gnocchi with Blistered Tomatoes$q$, 15, 2, $q$Vegetarian$q$,
       $q$1 pkg shelf-stable gnocchi
1 pint cherry tomatoes
⅓ cup basil pesto
4 oz fresh mozzarella
1 tbsp olive oil$q$,
       $q$Pan-fry gnocchi in the oil over medium-high, 6–8 min, until golden.
Add tomatoes; cook until they blister and burst, about 3 min.
Off the heat, stir in pesto. Top with torn mozzarella.$q$, 'Yes, Chef'),
      ($q$Turkey Taco Lettuce Wraps$q$, 20, 2, $q$Low-carb$q$,
       $q$1 lb ground turkey
1 head butter lettuce
1 tbsp taco seasoning
½ cup pico de gallo
½ cup shredded cheddar
¼ cup sour cream$q$,
       $q$Brown turkey, breaking it up, 6–8 min.
Add taco seasoning and ¼ cup water; simmer 2 min.
Spoon into lettuce cups; top with pico, cheese and sour cream.$q$, 'Yes, Chef'),
      ($q$Shrimp Fried Rice$q$, 20, 2, $q$Seafood$q$,
       $q$½ lb peeled shrimp
2 cups cooked rice
1 cup frozen peas & carrots
2 eggs
3 green onions
2 tbsp soy sauce
1 tsp sesame oil
1 tbsp vegetable oil$q$,
       $q$Scramble eggs in a hot oiled pan; set aside.
Cook shrimp 1–2 min per side; set aside.
Fry rice and frozen veg 4 min until hot and a little crisp.
Stir in soy sauce, sesame oil, eggs, shrimp and sliced green onion.$q$, 'Yes, Chef'),
      ($q$Honey Garlic Pork Chops$q$, 30, 2, $q$$q$,
       $q$2 boneless pork chops
½ lb green beans
3 tbsp honey
2 tbsp soy sauce
3 cloves garlic
1 tbsp butter$q$,
       $q$Season chops; sear 4–5 min per side until 145°F. Rest.
In the same pan, melt butter with garlic, honey and soy; simmer until syrupy.
Steam or sauté green beans 5 min.
Spoon the glaze over the chops and serve with beans.$q$, 'Yes, Chef'),
      ($q$Chickpea Coconut Curry$q$, 30, 2, $q$Vegetarian$q$,
       $q$1 can chickpeas
1 can coconut milk
1 yellow onion
2 tbsp curry powder
1 can diced tomatoes
2 cups baby spinach
¾ cup jasmine rice
2 cloves garlic$q$,
       $q$Cook rice.
Sauté diced onion 5 min; add garlic and curry powder for 1 min.
Add chickpeas, tomatoes and coconut milk; simmer 15 min.
Stir in spinach and season with salt. Serve over rice.$q$, 'Yes, Chef'),
      ($q$Smash Burgers & Oven Fries$q$, 35, 2, $q$$q$,
       $q$½ lb ground beef
2 brioche buns
1 lb russet potatoes
2 slices american cheese
½ yellow onion
2 tbsp olive oil
¼ cup dill pickles$q$,
       $q$Heat oven to 450°F. Cut potatoes into wedges, toss with oil and salt, roast 25–30 min.
Divide beef into 2 balls. In a very hot skillet, smash flat and season.
Cook 2 min, flip, top with cheese and thin-sliced onion; 1 min more.
Serve on toasted buns with pickles.$q$, 'Yes, Chef'),
      ($q$Greek Chicken Pitas$q$, 25, 2, $q$$q$,
       $q$¾ lb chicken breast
2 pitas
1 cucumber
½ pint cherry tomatoes
½ cup tzatziki
¼ cup feta
1 lemon
1 tsp dried oregano
1 tbsp olive oil$q$,
       $q$Toss sliced chicken with oil, lemon juice, oregano, salt and pepper.
Cook in a hot skillet 6–8 min until browned.
Chop cucumber and tomatoes.
Warm pitas; fill with chicken, veg, tzatziki and feta.$q$, 'Yes, Chef'),
      ($q$Weeknight Bolognese$q$, 35, 2, $q$$q$,
       $q$½ lb ground beef
6 oz spaghetti
1 can crushed tomatoes
½ yellow onion
1 carrot
2 cloves garlic
¼ cup parmesan
1 tsp italian seasoning$q$,
       $q$Boil spaghetti in salted water.
Brown beef with finely diced onion and grated carrot, 8 min.
Add garlic and seasoning, then tomatoes; simmer 15 min.
Toss with pasta and a splash of pasta water; top with parmesan.$q$, 'Yes, Chef'),
      ($q$Teriyaki Salmon Rice Bowls$q$, 25, 2, $q$Seafood$q$,
       $q$2 salmon fillets
¾ cup jasmine rice
⅓ cup teriyaki sauce
1 cucumber
1 avocado
1 tsp sesame seeds
2 green onions$q$,
       $q$Cook rice.
Brush salmon with half the teriyaki; roast at 400°F for 12 min.
Slice cucumber, avocado and green onion.
Serve salmon over rice with the veg; drizzle remaining sauce and sprinkle sesame.$q$, 'Yes, Chef'),
      ($q$Veggie Fajitas$q$, 25, 2, $q$Vegetarian$q$,
       $q$3 bell peppers
1 red onion
8 oz cremini mushrooms
6 flour tortillas
2 tsp fajita seasoning
1 lime
¼ cup sour cream
1 tbsp vegetable oil$q$,
       $q$Slice peppers, onion and mushrooms.
Sear in hot oil over high heat 8–10 min until charred at the edges.
Season with fajita seasoning and lime juice.
Warm tortillas and serve with sour cream.$q$, 'Yes, Chef'),
      ($q$BBQ Chicken Quesadillas$q$, 20, 2, $q$$q$,
       $q$2 cups shredded rotisserie chicken
4 flour tortillas
1 cup shredded cheddar
¼ cup bbq sauce
½ red onion
¼ cup cilantro$q$,
       $q$Toss chicken with BBQ sauce.
Layer cheese, chicken, thin-sliced onion and cilantro on half of each tortilla; fold.
Cook in a dry skillet 3 min per side until crisp and melty.
Cut into wedges.$q$, 'Yes, Chef'),
      ($q$Steak with Chimichurri & Potatoes$q$, 35, 2, $q$$q$,
       $q$¾ lb sirloin steak
1 lb baby potatoes
1 bunch parsley
3 cloves garlic
3 tbsp red wine vinegar
⅓ cup olive oil$q$,
       $q$Halve potatoes, toss with 1 tbsp of the oil and salt; roast at 425°F for 25 min.
Finely chop parsley and garlic; stir with vinegar, remaining oil, salt and chili flakes.
Season steak; sear 3–4 min per side for medium-rare. Rest 5 min.
Slice and spoon chimichurri over steak and potatoes.$q$, 'Yes, Chef');
  end if;
end
$seed$;
