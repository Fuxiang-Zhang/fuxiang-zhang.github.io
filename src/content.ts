/*
 * Interface copy only: buttons, status, errors and empty states. Every heading
 * and every sentence about the owner's work comes from data/site.md, so nothing
 * here can drift out of step with the page's content.
 */
export const copy = {
  placeholder:'Type /help or ask a question…', simulated:'Simulated reply', aiReply:'AI reply', chatLive:'chat: live', chatMock:'chat: simulated', chatConnected:'chat: connected', chatBudget:'chat: budget used up',
  budgetNotice:'Today’s question budget for the assistant is used up. Questions are available again at {time}. Commands still work.',
  offtopic:'That’s outside what this page covers. Ask me about my research, papers, or experience, or type /help for the commands.',
  askPaper:'Ask about this paper', askCommand:'[Ask AI]',
  noResults:'No publications in this group yet.', equal:'* denotes equal contribution.',
  send:'Send message', stop:'Stop response', stopped:'Response stopped.', failed:'The reply could not be delivered. Please check that the chat service is running, then try again.',
  retry:'Try again', copy:'Copy reply', copied:'Reply copied.', copyFailed:'Could not copy. You can select and copy the reply text.', thinking:'Preparing a reply…',
  authors:'Authors', venue:'Publication', abstract:'Abstract', openPaper:'Paper', openCode:'Code',
  detailDescription:'Answers come from an AI assistant; refer to the paper for research details.',
  paperPrompt:'Tell me about this paper: ', context:'Discussing', removeContext:'Remove paper context',
  loadError:'The homepage content could not be loaded.', reload:'Reload page',
  themeLight:'Switch to light theme', themeDark:'Switch to dark theme',
};
export type CopyKey = keyof typeof copy;
