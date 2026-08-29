import { createEditor, type EugineOperation } from "eugine";

// #region client
// A client id scopes undo to this user's own edits, and a client-scoped id
// factory keeps two browsers from ever minting the same node id.
const editor = createEditor({
  components: [{ type: "section", accepts: "*" }],
  clientId: "user-42",
  idFactory: () => `user-42_${crypto.randomUUID()}`,
});
// #endregion client

declare const socket: {
  send: (data: string) => void;
  onmessage: ((event: { data: string }) => void) | null;
};

// #region outbound
// Every committed transaction serializes to plain JSON operations.
// Never ship the whole document — that is last-write-wins by another name.
editor.history.onCommit(({ operations }) => {
  if (operations) socket.send(JSON.stringify(operations));
});
// #endregion outbound

// #region inbound
socket.onmessage = (event) => {
  const operations: unknown = JSON.parse(event.data);

  // applyRemote never touches the local undo stack, and drops operations
  // whose target this client already deleted rather than throwing.
  const { dropped } = editor.applyRemote(operations as EugineOperation[], {
    clientId: "user-7",
  });

  if (dropped.length > 0) console.debug("dropped stale operations", dropped);
};
// #endregion inbound

// #region origin
// Tell a local edit from one that arrived over the wire.
editor.events.on("document.change", ({ origin }) => {
  if (origin?.remote) console.debug("remote change from", origin.clientId);
});
// #endregion origin

// #region presence
editor.events.on("node.select", ({ ids }) => {
  socket.send(JSON.stringify({ type: "presence", user: "user-42", ids }));
});
// #endregion presence

export { editor };
