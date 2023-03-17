// Re-throw error if not an error from an Ownable smart contract.

export default function ownableErrorMessage(error: any): string {
  console.error(error);

  return error instanceof Error && error.message.match(/Custom Error val:/)
    ? error.message.replace(/^Custom Error val: "(.+)"$/, '$1')
    : "Internal error";
}
