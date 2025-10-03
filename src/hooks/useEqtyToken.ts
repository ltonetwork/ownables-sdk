import { useAccount, useBalance, useChainId } from 'wagmi';
import { BASE_EQTY_TOKEN, BASE_SEPOLIA_EQTY_TOKEN, BASE_CHAIN_ID, BASE_SEPOLIA_CHAIN_ID } from 'eqty-core';
import { FetchBalanceResult } from "@wagmi/core"

export type EqtyTokenBalance = { address?: string; balance?: FetchBalanceResult };
type UseBalanceParameters = Parameters<typeof useBalance>[0];

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * useEqtyToken
 * Returns { address, balance } for EQTY token on Base or Base Sepolia.
 * If chain is unsupported or token address is zero, returns {}.
 *
 * Params mirror wagmi's useBalance. You can override `address` and `chainId`.
 */
export default function useEqtyToken(params?: UseBalanceParameters): EqtyTokenBalance {
  const chainIdCtx = useChainId();
  const { address: currentAddress } = useAccount();

  const effectiveChainId = params?.chainId ?? chainIdCtx;
  const account = params?.address ?? currentAddress;

  let tokenAddress: string | undefined;
  if (effectiveChainId === BASE_CHAIN_ID) tokenAddress = BASE_EQTY_TOKEN as string;
  else if (effectiveChainId === BASE_SEPOLIA_CHAIN_ID) tokenAddress = BASE_SEPOLIA_EQTY_TOKEN as string;
  const isSupported =
    !!effectiveChainId &&
    !!account &&
    !!tokenAddress &&
    tokenAddress !== ZERO_ADDRESS;

  // Call wagmi's useBalance only when supported; leverage query.enabled to gate fetching
  const balanceQuery = useBalance({
    ...(params ?? {}),
    address: account as `0x${string}`,
    chainId: effectiveChainId,
    token: tokenAddress as `0x${string}` | undefined,
    enabled: isSupported,
  });

  if (!isSupported) return {};

  return { address: tokenAddress!, balance: balanceQuery.data };
};
