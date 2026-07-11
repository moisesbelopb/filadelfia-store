/** Traduz o código de erro de autenticação (query ?authError=) para PT-BR. */
export function authErrorMessage(code: string | null | undefined): string | null {
  switch (code) {
    case "oauth":
      return "Não foi possível concluir o login social. Tente novamente.";
    case "google":
      return "Falha ao iniciar o login com Google. Tente novamente.";
    case "config":
      return "Login social indisponível no momento.";
    case undefined:
    case null:
    case "":
      return null;
    default:
      return "Ocorreu um erro na autenticação. Tente novamente.";
  }
}
