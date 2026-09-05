/** Interface copy only. Everything factual about the homepage lives in the data/ files. */
export const copy = {
  sessions:'Sessions', conversations:'Conversations', reading:'Reading view',
  menu:'Open navigation', closeMenu:'Close navigation',
  bio:'Bio', research:'Research', publications:'Publications', experiences:'Experiences', miscellaneous:'Miscellaneous',
  greeting:'Hi, I’m',
  researchOpening:'My research centers on two threads.',
  publicationsOpening:'Here are all my publications, grouped by type. Click a title for details.',
  openAll:'All publications',
  experiencesOpening:'Here is my research and industry experience, followed by my education.',
  miscOpening:'Academic service and honors.',
  chatOpening:'Ask me anything about my research, papers, or experience.',
  inputLabel:'Your question', placeholder:'Type /help or ask a question…', simulated:'Simulated reply', aiReply:'AI reply', chatLive:'chat: live', chatMock:'chat: simulated', chatConnected:'chat: connected', chatBudget:'chat: budget used up',
  budgetNotice:'Today’s question budget for the assistant is used up. Questions are available again at {time}. Commands still work.',
  offtopic:'That’s outside what this page covers. Ask me about my research, papers, or experience, or type /help for the commands.',
  askPaper:'Ask about this paper', askCommand:'/ask',
  reports:'Reports & workshops', conference:'Conference papers', journal:'Journal papers',
  noResults:'No publications in this group yet.', equal:'* denotes equal contribution.',
  relatedPapers:'Related publications',
  education:'Education', experience:'Research & industry experience', service:'Academic service', awards:'Honors & awards',
  chatTitleShort:'New chat', send:'Send message', stop:'Stop response', stopped:'Response stopped.', failed:'The reply could not be delivered. Please check that the chat service is running, then try again.',
  retry:'Try again', copy:'Copy reply', copied:'Reply copied.', copyFailed:'Could not copy. You can select and copy the reply text.', thinking:'Preparing a reply…',
  authors:'Authors', venue:'Publication', abstract:'Abstract', openPaper:'Paper', openCode:'Code',
  detailDescription:'Answers come from an AI assistant; refer to the paper for research details.',
  paperPrompt:'Tell me about this paper: ', context:'Discussing', removeContext:'Remove paper context',
  loadError:'The homepage content could not be loaded.', reload:'Reload page', readingFallback:'Open the reading view',
  themeLight:'Switch to light theme', themeDark:'Switch to dark theme',
};
export type CopyKey = keyof typeof copy;
/** Suggested questions shown in a new chat; sending one goes through the same reply path as typed questions. */
export const suggestions = [
  'What do you work on?',
  'Which of your papers should I read first?',
  'What did you do at Skywork AI?',
];
