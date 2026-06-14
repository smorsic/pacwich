import { BLOG_URL } from "../util/env";

export const BlogLink = ({
  path,
  ...props
}: React.ComponentProps<"a"> & { path?: string }) => (
  <a
    href={path ? `${BLOG_URL}/${path}` : BLOG_URL}
    className="inline-link"
    target="_blank"
    rel="noopener noreferrer"
    {...props}
  />
);
