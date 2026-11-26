// Configurações do Clareou. Edite só este arquivo para personalizar o site.
module.exports = {
  nome: 'Clareou',
  assinatura: 'Cannabis medicinal, com clareza.',
  descricao: 'Blog independente e educativo sobre cannabis medicinal: ciência, cuidado e direitos explicados com clareza, para pacientes, famílias e profissionais de saúde.',

  // Endereço final do site (sem barra no fim). Troque quando tiver o domínio.
  url: 'https://clareou.blog.br',
  email: 'contato@clareou.blog.br',

  // Google AdSense. Deixe vazio até a conta ser aprovada.
  // Exemplo: adsenseClient: 'ca-pub-1234567890123456'
  adsenseClient: '',
  // Códigos (data-ad-slot) de cada bloco criado no AdSense. Vazio = bloco não aparece.
  adsenseSlots: { topo: '', feed: '', lateral: '', lateralFixo: '', artigo: '', rodape: '' },
  // true = mostra caixas tracejadas "Publicidade" onde os anúncios vão entrar (só para visualizar).
  mostrarEspacosDeAnuncio: false,

  // Endereço do formulário da newsletter (Buttondown, Brevo, Substack, Mailchimp…). Vazio = "em breve".
  newsletterAction: 'https://buttondown.com/api/emails/embed-subscribe/CLAREOU',
  // Endereço do formulário de perguntas (Formspree, Tally, Google Forms…). Vazio = "em breve".
  perguntaAction: 'https://formspree.io/f/xbgobaog',
  // ID do Google Analytics 4 (ex.: 'G-XXXXXXXXXX'). Opcional.
  analytics: '',
};
