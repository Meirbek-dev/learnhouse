function GeneralWrapperStyled({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-(--breakpoint-2xl) z-50 mx-auto px-4 py-5 tracking-tight sm:px-6 lg:px-8">{children}</div>
  );
}

export default GeneralWrapperStyled;
