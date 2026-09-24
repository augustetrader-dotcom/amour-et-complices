-- CORRECTION DE LA TABLE love_quiz_responses
-- Exécutez ce code dans Supabase SQL Editor pour corriger la contrainte unique

-- 1. Supprimer les doublons potentiels dans user_id
delete from love_quiz_responses 
where id in (
  select id from (
    select id, row_number() over (partition by user_id order by id) as rn 
    from love_quiz_responses
  ) t 
  where rn > 1
);

-- 2. Ajouter la contrainte unique sur user_id
alter table love_quiz_responses 
add constraint if not exists love_quiz_responses_user_id_key unique (user_id);