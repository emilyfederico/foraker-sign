export type LogoProps = React.ImgHTMLAttributes<HTMLImageElement>;

export const BrandingLogo = ({ ...props }: LogoProps) => {
  return (
    <img
      src="/foraker-logo.png"
      alt="Foraker Sign"
      style={{ height: '32px', filter: 'brightness(0) invert(1)' }}
      {...props}
    />
  );
};
