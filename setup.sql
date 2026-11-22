-- À coller dans Supabase > SQL Editor > Run (une seule fois)

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  identifiant text unique not null,
  is_admin boolean not null default false,
  seed_done boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.recettes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom text not null,
  saison text not null check (saison in ('ete','hiver','toutes')),
  tags text[] not null default '{}',
  ingredients text[] not null default '{}',
  created_at timestamptz not null default now()
);
create table public.dernier_menu (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recette_ids uuid[] not null default '{}'
);

alter table public.profiles enable row level security;
alter table public.recettes enable row level security;
alter table public.dernier_menu enable row level security;

-- Chacun ne voit et ne modifie que ses propres lignes
create policy "profil perso lecture" on public.profiles for select using (id = auth.uid());
create policy "profil perso maj" on public.profiles for update using (id = auth.uid());
create policy "recettes perso" on public.recettes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "menu perso" on public.dernier_menu for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Un utilisateur ne peut PAS se donner le statut admin : seule la colonne seed_done est modifiable
revoke update on public.profiles from anon, authenticated;
grant update (seed_done) on public.profiles to authenticated;

-- Droits d'accès aux tables (nécessaires sur les projets récents, où Supabase n'en donne plus automatiquement).
-- Les règles RLS ci-dessus restent le vrai filtre : chacun n'accède qu'à ses propres lignes.
grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.recettes to authenticated;
grant select, insert, update, delete on public.dernier_menu to authenticated;

-- Création automatique du profil à l'inscription (identifiant = partie avant le @)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, identifiant) values (new.id, split_part(new.email, '@', 1));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Fonctions réservées à l'admin (vérifiées côté base, pas côté navigateur)
create function public.liste_utilisateurs()
returns table (id uuid, identifiant text, is_admin boolean, nb_recettes bigint, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_admin) then
    raise exception 'acces refuse';
  end if;
  return query
    select p.id, p.identifiant, p.is_admin,
           (select count(*) from public.recettes r where r.user_id = p.id), p.created_at
    from public.profiles p order by p.identifiant;
end $$;

create function public.supprimer_utilisateur(cible uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_admin) then
    raise exception 'acces refuse';
  end if;
  if cible = auth.uid() then raise exception 'impossible de supprimer son propre compte admin'; end if;
  delete from auth.users where auth.users.id = cible;  -- supprime en cascade profil, recettes et menu
end $$;

revoke execute on function public.liste_utilisateurs() from public, anon;
revoke execute on function public.supprimer_utilisateur(uuid) from public, anon;
grant execute on function public.liste_utilisateurs() to authenticated;
grant execute on function public.supprimer_utilisateur(uuid) to authenticated;

-- À exécuter APRÈS avoir créé les utilisateurs "caroline" et "louis" (voir étapes dans la réponse) :
-- update public.profiles set is_admin = true where identifiant = 'louis';
