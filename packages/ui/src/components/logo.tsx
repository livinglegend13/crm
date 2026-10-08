import type * as React from "react";

const Logo = (props: React.SVGProps<SVGSVGElement>) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={512}
		height={512}
		viewBox="0 0 512 512"
		fill="none"
		aria-label="Terraeagle Logo"
		{...props}
	>
		<path d="M64 96h176v56h-57v264h-62V152H64V96Zm206 0h178v56H334v77h101v54H334v77h114v56H270V96Z" fill="currentColor" />
	</svg>
);
export default Logo;
