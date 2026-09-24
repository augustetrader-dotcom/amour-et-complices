-- ============================================================
-- Schéma Supabase complet — Quiz, Jeu, Mots doux, Chat, Couples
-- À exécuter dans l'éditeur SQL de ton projet Supabase
-- ============================================================

-- ------------------------------------------------------------
-- Profils publiques (source de vérité du profil, liée à auth.users)
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text unique,
  avatar_url text,
  bio text,
  theme text default 'default',
  sound boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_profiles_phone on profiles(phone);
create index if not exists idx_profiles_display_name on profiles(display_name);

-- Crée automatiquement un profil pour chaque nouvel utilisateur auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, phone, avatar_url, bio)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'avatar', '🌸'),
    coalesce(new.raw_user_meta_data->>'bio', '')
  );
  return new;
exception when unique_violation then
  -- En cas de conflit d'unicité (ex: numéro déjà pris), insère sans le téléphone pour ne jamais bloquer l'inscription
  insert into public.profiles (id, display_name, avatar_url, bio)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar', '🌸'),
    coalesce(new.raw_user_meta_data->>'bio', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- Couples & invitations
-- ------------------------------------------------------------
create table if not exists invites (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create table if not exists couples (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b)
);

create index if not exists idx_couples_user_a on couples(user_a);
create index if not exists idx_couples_user_b on couples(user_b);

-- ------------------------------------------------------------
-- Quiz de compatibilité
-- ------------------------------------------------------------
create table if not exists quiz_questions (
  id serial primary key,
  order_index integer not null,
  option_a_text text not null,
  option_a_language text not null check (option_a_language in ('words','quality_time','gifts','acts','touch')),
  option_b_text text not null,
  option_b_language text not null check (option_b_language in ('words','quality_time','gifts','acts','touch'))
);

create table if not exists quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scores jsonb not null,
  primary_language text not null,
  completed_at timestamptz not null default now()
);
create index if not exists idx_quiz_results_user on quiz_results(user_id, completed_at desc);

create table if not exists couple_compatibility (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  user_a_result_id uuid not null references quiz_results(id),
  user_b_result_id uuid not null references quiz_results(id),
  compatibility_score integer not null,
  shared_insights jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Jeu à deux (contenu, banque de 150 cartes)
-- ------------------------------------------------------------
create table if not exists game_cards (
  id serial primary key,
  category text not null,
  prompt text not null
);

-- ------------------------------------------------------------
-- Mots doux (contenu, banque de 1000 messages)
-- ------------------------------------------------------------
create table if not exists sweet_messages (
  id serial primary key,
  category text not null,
  text text not null
);

-- ------------------------------------------------------------
-- Chat
-- ------------------------------------------------------------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('text','photo','video','voice','once')),
  text text,
  media_path text,          -- chemin dans Supabase Storage (bucket chat-media)
  mime_type text,
  consumed boolean default false,  -- RÉSERVÉ aux messages "once" (déjà vu)
  delivered_at timestamptz,        -- reçu par l'appareil du destinataire (livré)
  read_at timestamptz,             -- messages normaux : marqué comme lu
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_couple on messages(couple_id, created_at asc);

-- -----------------------------------------------------------
-- [PHASE 1] Présence : date de dernier signal de vie de chaque
-- utilisateur (mise à jour par le heartbeat du frontend).
-- "En ligne" = last_seen datant de moins de 90 secondes.
-- -----------------------------------------------------------
alter table profiles add column if not exists last_seen timestamptz;
create index if not exists idx_profiles_last_seen on profiles(last_seen);

-- ============================================================
-- [PHASE 2] AMIS & CONVERSATIONS RÉELS (style WhatsApp)
-- Remplace toute la logique "en mémoire" des anciennes routes.
-- ============================================================

-- Demandes d'ami en attente (ajout par numéro de téléphone)
create table if not exists friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user   uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (from_user, to_user)
);
create index if not exists idx_friend_requests_to on friend_requests(to_user, status);

-- Amitiés acceptées (stockées dans les deux sens pour simplifier les requêtes)
create table if not exists friends (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);

-- Conversations unifiées : couple | ami | groupe.
-- La conversation "couple" est créée automatiquement au jumelage
-- (voir trigger plus bas) et réutilise la table `messages` existante.
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('couple','friend','group')),
  couple_id uuid references couples(id) on delete cascade,
  title text,
  icon text default '👥',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);

-- Membres d'une conversation (le couple = 2 membres, groupe = N membres)
create table if not exists conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists idx_conv_members_user on conversation_members(user_id);

-- Messages des conversations ami/groupe (le couple garde sa table `messages`)
create table if not exists group_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  type text not null default 'text' check (type in ('text','photo','video','voice')),
  text text,
  media_path text,   -- chemin dans Supabase Storage (bucket chat-media)
  mime_type text,
  created_at timestamptz not null default now()
);
create index if not exists idx_group_messages_conv on group_messages(conversation_id, created_at asc);

-- [CONFIRMATIONS DE LECTURE] confirmations de livraison/lecture (messages couple et groupes)
alter table messages add column if not exists delivered_at timestamptz;
alter table messages add column if not exists read_at timestamptz;
create index if not exists idx_messages_status on messages(couple_id, read_at);

-- [TICKS AMIS] confirmations de livraison/lecture pour les conversations
-- amis & groupes (même système que le chat couple)
alter table group_messages add column if not exists delivered_at timestamptz;
alter table group_messages add column if not exists read_at timestamptz;
create index if not exists idx_group_messages_status on group_messages(conversation_id, read_at);

-- [CRUD] édition et suppression douce des messages (les deux tables)
-- deleted=true -> affiché "🚫 Message supprimé" pour tout le monde
-- edited=true  -> mention "modifié" sous le message
alter table messages add column if not exists deleted boolean default false;
alter table messages add column if not exists edited boolean default false;
alter table group_messages add column if not exists deleted boolean default false;
alter table group_messages add column if not exists edited boolean default false;

-- [REPLY] Glisser pour répondre (style WhatsApp) : référence au message d'origine
-- reply_to_id      : UUID du message auquel on répond (NULL si pas une réponse)
-- reply_preview    : Extrait du texte cité (max 60 chars) ou "📷 Photo" etc.
-- reply_is_mine    : true si le message cité est de l'expéditeur lui-même
alter table messages add column if not exists reply_to_id uuid references messages(id) on delete set null;
alter table messages add column if not exists reply_preview text;
alter table messages add column if not exists reply_is_mine boolean default false;
alter table group_messages add column if not exists reply_to_id uuid references group_messages(id) on delete set null;
alter table group_messages add column if not exists reply_preview text;
alter table group_messages add column if not exists reply_is_mine boolean default false;


-- -----------------------------------------------------------
-- [PHASE 2] Trigger : à la création d'un couple, ouvre
-- automatiquement la conversation "couple" avec ses 2 membres.
-- -----------------------------------------------------------
create or replace function public.handle_new_couple()
returns trigger as $$
declare
  new_conv uuid;
begin
  insert into public.conversations (type, couple_id, icon, created_by)
  values ('couple', new.id, '❤️', new.user_a)
  returning id into new_conv;

  insert into public.conversation_members (conversation_id, user_id)
  values (new_conv, new.user_a), (new_conv, new.user_b);

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_couple_created on couples;
create trigger on_couple_created
  after insert on couples
  for each row execute procedure public.handle_new_couple();

-- ------------------------------------------------------------
-- Row Level Security
-- (chaque policy est droppée avant d'être recréée : le script est ré-exécutable)
-- ------------------------------------------------------------
alter table invites enable row level security;
alter table couples enable row level security;
alter table profiles enable row level security;
alter table quiz_results enable row level security;
alter table couple_compatibility enable row level security;
alter table messages enable row level security;
alter table game_cards enable row level security;
alter table sweet_messages enable row level security;

-- [PHASE 2] Nouvelles tables protégées par RLS
alter table friend_requests enable row level security;
alter table friends enable row level security;
alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table group_messages enable row level security;

-- Les profils sont lisibles par tout utilisateur connecté (nécessaire :
-- le numéro sert à retrouver un ami). Modifiables uniquement par leur propriétaire.
drop policy if exists "Lecture des profils connectés" on profiles;
drop policy if exists "Un utilisateur modifie son propre profil" on profiles;
create policy "Lecture des profils connectés" on profiles for select using (auth.uid() is not null);
create policy "Un utilisateur modifie son propre profil"
  on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Le contenu (quiz/jeu/mots doux) est public en lecture pour tout utilisateur connecté
drop policy if exists "Lecture publique du contenu quiz" on quiz_questions;
drop policy if exists "Lecture publique des cartes de jeu" on game_cards;
drop policy if exists "Lecture publique des mots doux" on sweet_messages;
create policy "Lecture publique du contenu quiz" on quiz_questions for select using (true);
create policy "Lecture publique des cartes de jeu" on game_cards for select using (true);
create policy "Lecture publique des mots doux" on sweet_messages for select using (true);

drop policy if exists "Un utilisateur gère ses propres invitations" on invites;
create policy "Un utilisateur gère ses propres invitations"
  on invites for all using (auth.uid() = user_id);

drop policy if exists "Un membre du couple voit son couple" on couples;
create policy "Un membre du couple voit son couple"
  on couples for select
  using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "Un utilisateur voit ses propres résultats de quiz" on quiz_results;
drop policy if exists "Un utilisateur insère ses propres résultats" on quiz_results;
create policy "Un utilisateur voit ses propres résultats de quiz"
  on quiz_results for select using (auth.uid() = user_id);
create policy "Un utilisateur insère ses propres résultats"
  on quiz_results for insert with check (auth.uid() = user_id);

drop policy if exists "Un membre du couple voit la compatibilité" on couple_compatibility;
create policy "Un membre du couple voit la compatibilité"
  on couple_compatibility for select
  using (exists (
    select 1 from couples
    where couples.id = couple_compatibility.couple_id
    and (couples.user_a = auth.uid() or couples.user_b = auth.uid())
  ));

drop policy if exists "Un membre du couple voit ses messages" on messages;
drop policy if exists "Un membre du couple peut écrire dans son chat" on messages;
drop policy if exists "Un membre du couple peut marquer un message comme consommé" on messages;
create policy "Un membre du couple voit ses messages"
  on messages for select
  using (exists (
    select 1 from couples
    where couples.id = messages.couple_id
    and (couples.user_a = auth.uid() or couples.user_b = auth.uid())
  ));
create policy "Un membre du couple peut écrire dans son chat"
  on messages for insert
  with check (
    auth.uid() = from_user
    and exists (
      select 1 from couples
      where couples.id = messages.couple_id
      and (couples.user_a = auth.uid() or couples.user_b = auth.uid())
    )
  );
create policy "Un membre du couple peut marquer un message comme consommé"
  on messages for update
  using (exists (
    select 1 from couples
    where couples.id = messages.couple_id
    and (couples.user_a = auth.uid() or couples.user_b = auth.uid())
  ));

-- ------------------------------------------------------------
-- [PHASE 2] RLS des amis, demandes d'ami et conversations
-- ------------------------------------------------------------

-- Demandes d'ami : visibles par l'expéditeur et le destinataire,
-- créées uniquement par l'expéditeur.
drop policy if exists "Demandes d'ami visibles par les deux parties" on friend_requests;
drop policy if exists "Créer une demande d'ami en son nom" on friend_requests;
drop policy if exists "Le destinataire peut répondre à une demande" on friend_requests;
create policy "Demandes d'ami visibles par les deux parties"
  on friend_requests for select using (auth.uid() = from_user or auth.uid() = to_user);
create policy "Créer une demande d'ami en son nom"
  on friend_requests for insert with check (auth.uid() = from_user);
create policy "Le destinataire peut répondre à une demande"
  on friend_requests for update using (auth.uid() = to_user);

-- Amitiés : lecture de ses propres amitiés seulement.
-- (Les insertions/amitiés se font côté serveur avec la clé service_role,
--  donc pas besoin de policy d'écriture ici.)
drop policy if exists "Voir ses propres amitiés" on friends;
create policy "Voir ses propres amitiés"
  on friends for select using (auth.uid() = user_id or auth.uid() = friend_id);

-- Conversations : visibles uniquement par leurs membres.
drop policy if exists "Voir ses conversations" on conversations;
create policy "Voir ses conversations"
  on conversations for select using (exists (
    select 1 from conversation_members m
    where m.conversation_id = conversations.id and m.user_id = auth.uid()
  ));

-- Membres : on voit les membres des conversations auxquelles on appartient.
drop policy if exists "Voir les membres de ses conversations" on conversation_members;
create policy "Voir les membres de ses conversations"
  on conversation_members for select using (exists (
    select 1 from conversation_members me
    where me.conversation_id = conversation_members.conversation_id and me.user_id = auth.uid()
  ));

-- Messages de groupe : lisibles/écrivables par les membres de la conversation.
drop policy if exists "Un membre voit les messages de sa conversation" on group_messages;
drop policy if exists "Un membre écrit dans sa conversation" on group_messages;
create policy "Un membre voit les messages de sa conversation"
  on group_messages for select using (exists (
    select 1 from conversation_members m
    where m.conversation_id = group_messages.conversation_id and m.user_id = auth.uid()
  ));
create policy "Un membre écrit dans sa conversation"
  on group_messages for insert with check (
    auth.uid() = from_user
    and exists (
      select 1 from conversation_members m
      where m.conversation_id = group_messages.conversation_id and m.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- [PHASE 4] ACTION OU VÉRITÉ — banque de cartes
-- levels : doux | complice | ose
-- ------------------------------------------------------------
create table if not exists truth_dare_cards (
  id serial primary key,
  kind text not null check (kind in ('verite','action')),
  level text not null default 'doux' check (level in ('doux','complice','ose')),
  prompt text not null
);

alter table truth_dare_cards enable row level security;
drop policy if exists "Lecture publique des cartes Action ou Vérité" on truth_dare_cards;
create policy "Lecture publique des cartes Action ou Vérité"
  on truth_dare_cards for select using (true);

-- ------------------------------------------------------------
-- [CRUD + LECTURE] Colonnes pour la fluidité des conversations :
-- - deleted : suppression "pour tous" (tombstone, comme WhatsApp)
-- - delivered_at / read_at sur les messages ami/groupe : coches ✓ / ✓✓ / ✓✓ bleues
-- ------------------------------------------------------------
alter table messages add column if not exists deleted boolean default false;
alter table group_messages add column if not exists delivered_at timestamptz;
alter table group_messages add column if not exists read_at timestamptz;
alter table group_messages add column if not exists deleted boolean default false;
create index if not exists idx_group_messages_unread on group_messages(conversation_id, read_at);

-- ------------------------------------------------------------
-- [STORIES] Photos/vidéos éphémères 24h (comme WhatsApp Status),
-- visibles uniquement par le couple. Purge automatique côté serveur.
-- ------------------------------------------------------------
create table if not exists stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references couples(id) on delete cascade,
  media_path text not null,          -- Storage : {coupleId}/stories/...
  mime_type text,
  caption text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index if not exists idx_stories_couple on stories(couple_id, expires_at desc);

alter table stories enable row level security;
drop policy if exists "Un membre du couple voit les stories" on stories;
drop policy if exists "Un membre du couple publie sa story" on stories;
drop policy if exists "Chacun supprime sa propre story" on stories;
create policy "Un membre du couple voit les stories"
  on stories for select using (exists (
    select 1 from couples
    where couples.id = stories.couple_id
    and (couples.user_a = auth.uid() or couples.user_b = auth.uid())
  ));
create policy "Un membre du couple publie sa story"
  on stories for insert with check (auth.uid() = user_id);
create policy "Chacun supprime sa propre story"
  on stories for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- [ALBUM] Souvenirs PERSISTANTS des groupes (l'ancien album était
-- stocké en mémoire et disparaissait au redémarrage).
-- ------------------------------------------------------------
create table if not exists group_memories (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  caption text,
  image_path text not null,          -- Storage : conv/{conversationId}/memories/...
  created_at timestamptz not null default now()
);
create index if not exists idx_group_memories_conv on group_memories(conversation_id, created_at desc);

alter table group_memories enable row level security;
drop policy if exists "Un membre voit les souvenirs du groupe" on group_memories;
drop policy if exists "Un membre ajoute un souvenir" on group_memories;
create policy "Un membre voit les souvenirs du groupe"
  on group_memories for select using (exists (
    select 1 from conversation_members m
    where m.conversation_id = group_memories.conversation_id and m.user_id = auth.uid()
  ));
create policy "Un membre ajoute un souvenir"
  on group_memories for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from conversation_members m
      where m.conversation_id = group_memories.conversation_id and m.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- [PUSH] Abonnements aux notifications push natives (Web Push).
-- Un appareil = un abonnement (endpoint unique).
-- ------------------------------------------------------------
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
drop policy if exists "Chacun gère ses abonnements push" on push_subscriptions;
create policy "Chacun gère ses abonnements push"
  on push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- [JEU SYNCHRONISÉ] État partagé du Défi complice (1 ligne par couple) :
-- même carte pour les deux partenaires, réponses stockées par utilisateur,
-- révélation croisée uniquement quand les deux ont répondu.
-- ------------------------------------------------------------
create table if not exists game_state (
  couple_id uuid primary key references couples(id) on delete cascade,
  card_id integer,
  card_prompt text,
  card_category text,
  answers jsonb not null default '{}'::jsonb,  -- { "<userId>": "réponse" }
  status text not null default 'waiting' check (status in ('waiting','revealed')),
  updated_at timestamptz not null default now()
);

alter table game_state enable row level security;
drop policy if exists "Un membre du couple voit l'état du jeu" on game_state;
drop policy if exists "Un membre du couple démarre une partie" on game_state;
drop policy if exists "Un membre du couple joue" on game_state;
create policy "Un membre du couple voit l'état du jeu"
  on game_state for select using (exists (
    select 1 from couples
    where couples.id = game_state.couple_id
    and (couples.user_a = auth.uid() or couples.user_b = auth.uid())
  ));
create policy "Un membre du couple démarre une partie"
  on game_state for insert with check (exists (
    select 1 from couples
    where couples.id = game_state.couple_id
    and (couples.user_a = auth.uid() or couples.user_b = auth.uid())
  ));
create policy "Un membre du couple joue"
  on game_state for update using (exists (
    select 1 from couples
    where couples.id = game_state.couple_id
    and (couples.user_a = auth.uid() or couples.user_b = auth.uid())
  ));

-- ------------------------------------------------------------
-- Realtime : active le suivi des changements sur messages
-- IMPORTANT : sur certains projets, seul le dashboard permet ça
-- (Database > Replication). Ce bloc est donc NON-BLOQUANT : s'il
-- échoue, le reste du script continue sans erreur.
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  -- [PHASE 2] Realtime pour les messages de conversations amis/groupes
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'group_messages'
  ) then
    alter publication supabase_realtime add table public.group_messages;
  end if;
exception when others then
  raise notice 'Realtime non activé par SQL : utilise Database > Replication dans le dashboard.';
end $$;

-- ------------------------------------------------------------
-- Storage : bucket privé pour les médias du chat et stories
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do nothing;

drop policy if exists "Accès média du couple" on storage.objects;
drop policy if exists "Accès média chat et stories" on storage.objects;

create policy "Accès média chat et stories"
  on storage.objects for all
  using (
    bucket_id = 'chat-media'
    and (
      -- 1. Chemins de couple : {coupleId}/...
      exists (
        select 1 from couples
        where couples.id::text = (storage.foldername(name))[1]
        and (couples.user_a = auth.uid() or couples.user_b = auth.uid())
      )
      or
      -- 2. Chemins de conversation : conv/{conversationId}/...
      (
        (storage.foldername(name))[1] = 'conv'
        and exists (
          select 1 from conversation_members m
          where m.conversation_id::text = (storage.foldername(name))[2]
          and m.user_id = auth.uid()
        )
      )
    )
  )
  with check (
    bucket_id = 'chat-media'
  );

-- ------------------------------------------------------------
-- [QUESTIONNAIRE D'AMOUR] Réponses au questionnaire de personnalisation
-- Stocke les préférences de l'utilisateur pour personnaliser l'app
-- ------------------------------------------------------------
create table if not exists love_quiz_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  responses jsonb not null default '{}'::jsonb,  -- { "question_id": "answer_value" }
  personalization_settings jsonb not null default '{}'::jsonb,  -- Settings dérivés des réponses
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table love_quiz_responses enable row level security;
drop policy if exists "Un utilisateur voit ses propres réponses" on love_quiz_responses;
drop policy if exists "Un utilisateur modifie ses propres réponses" on love_quiz_responses;
create policy "Un utilisateur voit ses propres réponses"
  on love_quiz_responses for select using (auth.uid() = user_id);
create policy "Un utilisateur modifie ses propres réponses"
  on love_quiz_responses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Ajouter une colonne dans profiles pour savoir si le questionnaire est complété
alter table profiles add column if not exists love_quiz_completed boolean default false;
