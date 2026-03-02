"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useAuth } from "@/contexts/AuthContext";
import { DustLogo } from "@/components/DustLogo";
import { getSupportedChains } from "@/config/chains";
import { ChainIcon as ChainTokenIcon } from "@/components/stealth/icons";
import { FeatureMatrix } from "@/components/ui/FeatureMatrix";
import { MenuIcon, XIcon, ChevronDownIcon, CopyIcon, LogOutIcon, CheckIcon } from "lucide-react";
import { isPrivyEnabled } from "@/config/privy";
import { useLogin, usePrivy, useLogout } from "@privy-io/react-auth";

const noop = () => {};
const noopAsync = async () => {};

// Safe Privy hook wrappers — return stubs when PrivyProvider is absent (E2E test mode).
// isPrivyEnabled is a module-level constant so the branch is stable across renders.
function useLoginSafe() {
  if (!isPrivyEnabled) return { login: noop };
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useLogin();
}
function usePrivySafe() {
  if (!isPrivyEnabled) return { authenticated: false, ready: true };
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return usePrivy();
}
function useLogoutSafe() {
  if (!isPrivyEnabled) return { logout: noopAsync };
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useLogout();
}

const chains = getSupportedChains();

function shortChainName(name: string): string {
  return name.replace(/\s*Sepolia\s*/i, '').trim() || name;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/swap", label: "Swap" },
  { href: "/pools", label: "Shield" },
  { href: "/wallet", label: "Wallet" },
  { href: "/links", label: "Links" },
  { href: "/activities", label: "Activity" },
  { href: "/settings", label: "Settings" },
  { href: "/docs", label: "Docs" },
];

function isNavActive(itemHref: string, pathname: string) {
  if (itemHref === "/docs") return pathname.startsWith("/docs");
  return pathname === itemHref;
}

export function Navbar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect } = useConnect();
  const { login: privyLogin } = useLoginSafe();
  const { authenticated: privyAuthenticated, ready: privyReady } = usePrivySafe();
  const { logout: privyLogout } = useLogoutSafe();
  const { activeChainId, setActiveChain } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [chainDropdownOpen, setChainDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const walletRef = useRef<HTMLDivElement>(null);
  const chainBadgeRef = useRef<HTMLDivElement>(null);

  const activeChain = chains.find(c => c.id === activeChainId) || chains[0];

  const displayName = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;

  const handleConnect = async () => {
    if (isPrivyEnabled) {
      // Stale session: Privy thinks user is authenticated but wagmi has no connection.
      // Clear the stale Privy session first, then re-login on next click.
      if (privyReady && privyAuthenticated && !isConnected) {
        await privyLogout();
      }
      privyLogin();
    } else {
      connect({ connector: injected() });
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) {
        setWalletOpen(false);
      }
      if (chainBadgeRef.current && !chainBadgeRef.current.contains(e.target as Node)) {
        setChainDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function selectChain(chainId: number) {
    setActiveChain(chainId);
    setChainDropdownOpen(false);
    setMobileOpen(false);
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#06080F]/95 backdrop-blur-md border-b border-white/[0.04] flex items-center px-4 lg:px-8">

        {/* Left — logo */}
        <div className="flex-1 flex items-center min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
            <DustLogo size={24} color="#00FF41" className="group-hover:drop-shadow-[0_0_8px_rgba(0,255,65,0.6)] transition-all duration-300" />
            <span className="flex items-baseline gap-2">
              <span className="text-base font-bold tracking-[0.2em] text-white font-mono group-hover:text-[#00FF41] transition-colors duration-300">DUST</span>
              <span className="hidden sm:inline text-[10px] font-mono tracking-[0.3em] text-[#00FF41]/50 uppercase group-hover:text-[#00FF41]/80 transition-colors duration-300">PROTOCOL</span>
            </span>
          </Link>
        </div>

        {/* Center — nav links */}
        <div className="hidden lg:flex items-center gap-1 xl:gap-1.5 shrink-0">
          {isConnected && navItems.map(item => {
            const isActive = isNavActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative inline-flex items-center px-2.5 xl:px-4 py-2 text-[10px] xl:text-[11px] font-mono tracking-widest transition-all duration-300 rounded-sm whitespace-nowrap group ${isActive
                    ? 'text-[#00FF41]'
                    : 'text-white/40 hover:text-white/80'
                  }`}
              >
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-[1px] bg-[#00FF41]/70" />
                )}
                {item.label.toUpperCase()}
              </Link>
            );
          })}
        </div>

        {/* Right — chain badge + wallet button + hamburger */}
        <div className="flex-1 flex items-center justify-end gap-2 sm:gap-3 min-w-0">

          {/* Chain badge */}
          {isConnected && (
            <div className="relative shrink-0" ref={chainBadgeRef}>
              <button
                onClick={() => setChainDropdownOpen(v => !v)}
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-sm border border-white/10 bg-[#0a0d14] hover:bg-[#0a0d14]/80 hover:border-[#00FF41]/40 transition-all duration-300 group shadow-sm"
              >
                <ChainTokenIcon size={16} chainId={activeChain.id} />
                <span className="hidden sm:inline text-[11px] font-mono text-white/70 group-hover:text-[#00FF41] transition-colors tracking-wide">
                  {shortChainName(activeChain.name).toUpperCase()}
                </span>
                <ChevronDownIcon
                  className="w-3 h-3 text-white/30 group-hover:text-[#00FF41]/70 transition-all duration-300"
                  style={{ transform: chainDropdownOpen ? "rotate(180deg)" : "none" }}
                />
              </button>

              {chainDropdownOpen && (
                <div className="absolute top-[calc(100%+8px)] right-0 bg-[#0a0d14] border border-[#00FF41]/20 rounded-sm min-w-[220px] z-50 overflow-hidden shadow-[0_8px_32px_-4px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="px-4 pt-3 pb-2 border-b border-white/[0.04]">
                    <span className="text-[10px] font-mono text-[#00FF41]/50 tracking-[0.2em] uppercase">Network</span>
                  </div>
                  <div className="py-1">
                    {chains.map(chain => {
                      const isActive = chain.id === activeChainId;
                      return (
                        <button
                          key={chain.id}
                          onClick={() => selectChain(chain.id)}
                          className={`w-full text-left px-4 py-2.5 text-xs font-mono transition-all flex items-center gap-3 relative group ${isActive
                              ? 'text-[#00FF41] bg-[#00FF41]/[0.08]'
                              : 'text-white/60 hover:bg-white/[0.04] hover:text-white'
                            }`}
                        >
                          {isActive && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#00FF41] shadow-[0_0_8px_rgba(0,255,65,1)]" />}
                          <ChainTokenIcon size={16} chainId={chain.id} />
                          <span className="flex-1 tracking-wide">{chain.name}</span>
                          {isActive && <span className="w-1.5 h-1.5 bg-[#00FF41] shadow-[0_0_6px_rgba(0,255,65,0.8)] rounded-sm"></span>}
                        </button>
                      );
                    })}
                  </div>
                  {/* Feature availability for selected chain */}
                  <div className="border-t border-white/[0.04]">
                    <div className="px-4 pt-2.5 pb-1">
                      <span className="text-[10px] font-mono text-white/25 tracking-[0.2em] uppercase">Features</span>
                    </div>
                    <FeatureMatrix chainId={activeChainId} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Wallet button */}
          <div className="relative shrink-0" ref={walletRef}>
            {displayName ? (
              <>
                <button
                  onClick={() => setWalletOpen(v => !v)}
                  className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-sm border border-white/10 bg-[#0a0d14] hover:bg-[#0a0d14]/80 hover:border-[#00FF41]/40 transition-all duration-300 group shadow-sm"
                >
                  <div className="w-1.5 h-1.5 bg-[#00FF41] animate-pulse shrink-0 rounded-sm" />
                  <span className="hidden sm:inline text-xs font-mono text-white/90 group-hover:text-[#00FF41] transition-colors">{displayName}</span>
                  <ChevronDownIcon
                    className="w-3.5 h-3.5 text-white/40 group-hover:text-[#00FF41]/70 transition-all duration-300"
                    style={{ transform: walletOpen ? "rotate(180deg)" : "none" }}
                  />
                </button>

                {walletOpen && (
                  <div className="absolute top-[calc(100%+8px)] right-0 bg-[#0a0d14] border border-[#00FF41]/20 rounded-sm min-w-[220px] z-50 overflow-hidden shadow-[0_8px_32px_-4px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="py-1">
                      <button
                        onClick={copyAddress}
                        className="w-full text-left px-4 py-2.5 text-xs font-mono text-white/50 hover:bg-white/[0.04] hover:text-white transition-all flex items-center gap-3"
                      >
                        {copied ? <CheckIcon className="w-4 h-4 text-[#00FF41]" /> : <CopyIcon className="w-4 h-4" />}
                        <span className="tracking-wide">{copied ? "COPIED TO CLIPBOARD" : "COPY ADDRESS"}</span>
                      </button>
                      <button
                        onClick={() => { disconnect(); if (isPrivyEnabled) privyLogout(); setWalletOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-xs font-mono text-[#ff4b4b]/70 hover:bg-[#ff4b4b]/[0.05] hover:text-[#ff4b4b] transition-all flex items-center gap-3"
                      >
                        <LogOutIcon className="w-4 h-4" />
                        <span className="tracking-wide">DISCONNECT</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={handleConnect}
                className="relative px-5 py-2 text-[11px] font-mono font-bold tracking-widest text-[#00FF41] border border-[#00FF41]/30 bg-[#00FF41]/[0.05] rounded-sm hover:border-[#00FF41] hover:bg-[#00FF41]/[0.1] hover:shadow-[0_0_12px_rgba(0,255,65,0.2)] transition-all duration-300 group overflow-hidden"
              >
                <div className="absolute inset-0 w-[200%] bg-gradient-to-r from-transparent via-[#00FF41]/20 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                <span className="relative">CONNECT WALLET</span>
              </button>
            )}
          </div>

          {/* Hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden shrink-0 w-9 h-9 flex items-center justify-center rounded-sm border border-white/10 bg-[#0a0d14] text-white/60 hover:text-white transition-all"
          >
            {mobileOpen ? <XIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-[#0a0d14]/95 backdrop-blur-xl border-b border-[#00FF41]/20 flex flex-col py-3 shadow-[0_8px_32px_rgba(0,0,0,0.8)] animate-in slide-in-from-top-2 duration-200">
          {/* Mobile chain switcher */}
          {isConnected && (
            <div className="px-3 mb-2 pb-2 border-b border-white/[0.04]">
              <span className="block px-4 pb-2 text-[10px] font-mono text-[#00FF41]/50 tracking-[0.2em] uppercase">Network</span>
              <div className="flex flex-col gap-0.5">
                {chains.map(chain => {
                  const isActive = chain.id === activeChainId;
                  return (
                    <button
                      key={chain.id}
                      onClick={() => selectChain(chain.id)}
                      className={`flex items-center gap-3 px-4 py-2.5 text-xs font-mono tracking-widest transition-all rounded-sm relative ${isActive
                          ? 'text-[#00FF41] bg-[#00FF41]/[0.08] border-l-2 border-[#00FF41]'
                          : 'text-white/50 hover:text-white hover:bg-white/[0.04] border-l-2 border-transparent'
                        }`}
                    >
                      <ChainTokenIcon size={16} chainId={chain.id} />
                      <span>{chain.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-0.5 px-3">
            {isConnected ? navItems.map(item => {
              const isActive = isNavActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center px-4 py-3.5 text-xs font-mono tracking-widest transition-all rounded-sm relative ${isActive
                      ? 'text-[#00FF41] bg-[#00FF41]/[0.08] border-l-2 border-[#00FF41]'
                      : 'text-white/50 hover:text-white hover:bg-white/[0.04] border-l-2 border-transparent'
                    }`}
                >
                  <span className="relative z-10">{item.label.toUpperCase()}</span>
                </Link>
              );
            }) : (
              <button
                onClick={() => { handleConnect(); setMobileOpen(false); }}
                className="mx-1 mt-2 py-3.5 relative text-xs font-mono font-bold tracking-widest text-[#00FF41] border border-[#00FF41]/30 bg-[#00FF41]/[0.05] rounded-sm hover:border-[#00FF41] hover:bg-[#00FF41]/[0.1] transition-all flex items-center justify-center shadow-[0_0_12px_rgba(0,255,65,0.1)] overflow-hidden group"
              >
                <div className="absolute inset-0 w-[200%] bg-gradient-to-r from-transparent via-[#00FF41]/20 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                <span className="relative">CONNECT WALLET</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
