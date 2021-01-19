import Box from '@material-ui/core/Box';
import Grid from '@material-ui/core/Grid';
import Icon from '@material-ui/core/Icon';
import Link from '@material-ui/core/Link';
import Typography from '@material-ui/core/Typography';
import useMediaQuery from '@material-ui/core/useMediaQuery';


export function Entry({icon, title, leftTitle, desc, leftDesc, inline}) {

    const xs = !useMediaQuery(theme => theme.breakpoints.up('sm'));

    return (
        <Grid container item xs={12} spacing={xs ? 0 : 1}>
          <Grid container item
                xs={inline ? 2 : 12}
                sm={2}
                spacing={1} justify={xs ? undefined : "flex-end"}
                alignItems="flex-start" align={xs ? undefined : "right"}
          >
            {leftTitle && (
                <Grid item>
                  <Typography component="span">
                    {leftTitle}
                  </Typography>
                </Grid>
            )}
            {icon && (
                <Grid item>
                  <Typography component="span">
                    {icon}
                  </Typography>
                </Grid>
            )}
          </Grid>
          <Grid container item
                xs={inline ? 10 : 12}
                sm={10}
          >
            {title && (
                <Grid item xs={12}>
                  <Typography component="span">
                    {title}
                  </Typography>
                </Grid>
            )}
            {desc && (
                <Grid item xs={12}>
                  <Typography component="span">
                    {desc}
                  </Typography>
                </Grid>
            )}
          </Grid>
        </Grid>
    );
}

export function Experience({date, title, at, children}) {
    return (
        <Box my={1}>
          <Entry
            title={
                <span>
                  <strong>
                    {title}
                  </strong>
                  {at && <span>, {at}</span>}
                </span>
            }
            leftTitle={
                <small>{date}</small>
            }
            desc={
                children
            }
          />
        </Box>
    );
}

export function Publication({date, title, href, at, children}) {
    return (
        <Box my={1}>
          <Entry
            title={
                <span>
                  <Link href={href}>
                    <strong>{title}</strong>
                  </Link>
                  {at && <span>, {at}</span>}
                </span>
            }
            leftTitle={
                <small>{date}</small>
            }
            desc={
                children
            }
          />
        </Box>
    );
}

export function Github({name, stars, users, children}) {
    return (
        <Box my={1}>
          <Entry
            title={
                <Link href={"https://github.com/wapiflapi/" + name}>
                  github.com/wapiflapi/
                  <strong>{name}</strong>
                </Link>
            }
            leftTitle={stars || users}
            icon={
                <Icon fontSize="small">
                  {stars ? "star" : "people"}
                </Icon>
            }
            desc={children}
          />
        </Box>
    );
}

export function Section({title, children}) {
    return (
        <Box my={2}>
          <Entry title={
              <Typography variant="h4" component="h2">
                {title}
              </Typography>
          }/>
          {children}
        </Box>
    );
}
