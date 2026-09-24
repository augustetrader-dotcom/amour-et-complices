// Utilitaire pour traduire les messages d'erreur en français
function translateError(errorMessage) {
  if (!errorMessage) return "Erreur inconnue";
  
  const msg = errorMessage.toLowerCase();
  
  // Erreurs d'authentification Supabase
  if (msg.includes("invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (msg.includes("user already registered") || msg.includes("already registered") || msg.includes("a user with this email address has already been registered")) {
    return "Un compte avec cet email existe déjà. Connectez-vous plutôt.";
  }
  if (msg.includes("email not confirmed")) {
    return "Email non confirmé. Veuillez vérifier votre boîte mail.";
  }
  if (msg.includes("password should be at least")) {
    return "Le mot de passe doit contenir au moins 6 caractères.";
  }
  if (msg.includes("unable to validate email address")) {
    return "Adresse email invalide.";
  }
  if (msg.includes("invalid email")) {
    return "Adresse email invalide.";
  }
  
  // Erreurs de base de données
  if (msg.includes("duplicate key") || msg.includes("unique constraint")) {
    return "Cette valeur existe déjà.";
  }
  if (msg.includes("foreign key constraint")) {
    return "Relation invalide avec une autre donnée.";
  }
  if (msg.includes("null value") || msg.includes("not null")) {
    return "Champ requis manquant.";
  }
  
  // Erreurs réseau
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return "Délai d'attente dépassé. Veuillez réessayer.";
  }
  if (msg.includes("connection") && msg.includes("refused")) {
    return "Connexion refusée. Vérifiez que le serveur est démarré.";
  }
  
  // Erreurs de fichiers
  if (msg.includes("file too large") || msg.includes("payload too large")) {
    return "Fichier trop volumineux.";
  }
  if (msg.includes("invalid file") || msg.includes("unsupported media type")) {
    return "Type de fichier non supporté.";
  }
  
  // Erreurs de permissions
  if (msg.includes("permission denied") || msg.includes("access denied")) {
    return "Accès refusé.";
  }
  if (msg.includes("unauthorized") || msg.includes("401")) {
    return "Non autorisé. Veuillez vous reconnecter.";
  }
  if (msg.includes("forbidden") || msg.includes("403")) {
    return "Accès interdit.";
  }
  
  // Erreurs générales
  if (msg.includes("not found") || msg.includes("404")) {
    return "Ressource introuvable.";
  }
  if (msg.includes("bad request") || msg.includes("400")) {
    return "Requête invalide.";
  }
  if (msg.includes("internal server error") || msg.includes("500")) {
    return "Erreur serveur. Veuillez réessayer.";
  }
  
  // Si le message est déjà en français ou ne correspond à aucun pattern connu
  if (msg.includes("erreur") || msg.includes("required") || msg.includes("introuvable")) {
    return errorMessage;
  }
  
  // Par défaut, retourner le message original s'il semble être en français
  // Sinon, un message générique
  return errorMessage.includes(" ") ? errorMessage : "Erreur survenue. Veuillez réessayer.";
}

module.exports = { translateError };