import Box from '@material-ui/core/Box';
import Grid from '@material-ui/core/Grid';
import Icon from '@material-ui/core/Icon';
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
                  <Typography>
                    {leftTitle}
                  </Typography>
                </Grid>
            )}
            {icon && (
                <Grid item>
                  <Typography>
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
                  <Typography>
                    {title}
                  </Typography>
                </Grid>
            )}
            {desc && (
                <Grid item xs={12}>
                  <Typography>
                    {desc}
                  </Typography>
                </Grid>
            )}
          </Grid>
        </Grid>
    );
}

export function Experience({date, title, at, description}) {
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
                description
            }
          />
        </Box>
    );
}

export function Github({name, stars, users, description}) {
    return (
        <Box my={1}>
          <Entry
            title={
                <a href={"https://github.com/wapiflapi/" + name}>
                  github.com/wapiflapi/
                  <strong>{name}</strong>
                </a>
            }
            leftTitle={stars || users}
            icon={<Icon fontSize="small">{stars ? "star" : "people"}</Icon>}
            desc={description}
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
