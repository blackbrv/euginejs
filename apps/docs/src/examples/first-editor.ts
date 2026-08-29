// #region create
import { createEditor } from "eugine";

const editor = createEditor({
  components: [
    { type: "section", label: "Section", accepts: "*" },
    {
      type: "text",
      label: "Text",
      accepts: "none",
      defaults: { props: { content: "Hello world" } },
    },
  ],
});
// #endregion create

// #region insert
const root = editor.getDocument().rootId;
const heroId = editor.insert("section", root);
const textId = editor.insert("text", heroId, { props: { content: "Built with Eugine" } });
// #endregion insert

// #region edit
editor.updateProps(textId, { content: "Edited copy" });
editor.updateStyles(heroId, { padding: "48px", background: "#f5f5f5" });
// #endregion edit

// #region history
editor.history.undo(); // reverts the style change
editor.history.redo(); // re-applies it
// #endregion history

// #region transaction
// One user action, one undo step — even though it runs three commands.
editor.transaction(() => {
  const card = editor.insert("section", root);
  editor.insert("text", card, { props: { content: "Title" } });
  editor.insert("text", card, { props: { content: "Body" } });
}, "add card");
// #endregion transaction

export { editor, heroId, textId };
