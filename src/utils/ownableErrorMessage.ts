// Re-throw error if not an error from an Ownable smart contract.

export default function ownableErrorMessage(error: any): string {
  if (!(error instanceof Error ) || !error.message.match(/^Ownable \w+ failed$/)) {
    console.error(error);
    return "Internal error";
  }

  console.error(error.cause);
  return (error.cause as Error).message.replace(/^Custom Error val: "(.+)"$/, '$1');
}
