import { Client, Databases, ID, Query } from 'node-appwrite';
import fetch from 'node-fetch';

// This is your Appwrite function
// It's executed each time we get a request
export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_BASE_URL)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);

  const discordAccessToken = req.body.providerAccessToken;
  log('Discord Access Token');
  log(discordAccessToken);

  if (!discordAccessToken) {
    error('Missing Discord Access Token');
    return res.status(403).json({
      ok: false,
      message: 'Missing Discord Access',
    });
  }

  try {
    const url = `${process.env.DISCORD_BASE_URL}/users/@me/guilds`;
    const headers = {
      Authorization: `Bearer ${discordAccessToken}`,
    };

    const response = await fetch(url, { headers });
    const guilds = await response.json();

    log('User Servers');
    log(guilds);

    let userAdminServers = [];

    async function fetchAdminGuilds(allGuilds) {
      const adminServers = [];
      const headers = {
        Authorization: `Bearer ${discordAccessToken}`,
      };

      for (const guild of allGuilds) {
        try {
          log('Fetching permissions of guild  ' + guild.id);
          // const memberUrl = `${process.env.DISCORD_BASE_URL}/guilds/${guild.id}/members/@me`;
          // const memberResponse = await fetch(memberUrl, { headers });
          // const memberData = await memberResponse.json();

          const hasAdminPerms = guild?.permissions == '562949953421311'; // Check for Administrator permission (value: 8)
          if (hasAdminPerms) {
            adminServers.push(guild);
            log('This guild has admin permissions:');
            log(guild);
          }
        } catch (error) {
          error(`Error fetching guild ${guild?.id}:`, error);
          return res.json({
            ok: false,
            message: `Failed to get information about server ${guild?.id}`,
          });
        }
      }

      return adminServers;
    }
    // Populate guilds with your guild objects
    fetchAdminGuilds(guilds)
      .then((adminServers) => {
        const servers = adminServers;
        userAdminServers = servers;
      })
      .catch((error) => {
        error('Error fetching admin servers:', error);
        return res.json({
          ok: false,
          message: `Failed to fetch admin servers`,
        });
      });

    try {
      const user = await databases.listDocuments(
        process.env.APPWRITE_DATABASE_ID,
        'users',
        [Query.equal('user_id', req.body.userId)]
      );

      log('User Document');
      log(user);

      if (user?.total >= 1) {
        const existingServers = user?.documents[0]?.servers;

        log('Existing Servers');
        log(existingServers);

        log('Admin Servers');
        log(userAdminServers);

        for (const server of userAdminServers) {
          if (!existingServers || existingServers?.length == 0) {
            try {
              await databases.updateDocument(
                process.env.APPWRITE_DATABASE_ID,
                'users',
                user?.documents[0]?.$id,
                {
                  servers: [
                    {
                      $id: server?.id,
                      server_id: server?.id,
                      name: server?.name,
                      ...(server?.icon && {
                        thumbnail_url: `${process.env.DISCORD_CDN_URL}/icons/${server?.id}/${server?.icon}.png`,
                      }),
                    },
                  ],
                }
              );
              return res.json({
                message: 'User servers created successfully!',
              });
            } catch (err) {
              error('Error while creating user servers');
              error(err);
              return res.json({
                ok: false,
                message: 'Error while creating user servers',
              });
            }
          }
          if (
            !existingServers
              ?.map((item) => item?.server_id)
              ?.includes(server?.id)
          ) {
            try {
              log('Adding Server');
              log(server);
              try {
                await databases.updateDocument(
                  process.env.APPWRITE_DATABASE_ID,
                  'users',
                  user?.documents[0]?.$id,
                  {
                    servers: [
                      {
                        $id: server?.id,
                        server_id: server?.id,
                        name: server?.name,
                        ...(server?.icon && {
                          thumbnail_url: `${process.env.DISCORD_CDN_URL}/icons/${server?.id}/${server?.icon}.png`,
                        }),
                      },
                    ],
                  }
                );
                return res.json({
                  message: 'User servers updated successfully!',
                });
              } catch (err) {
                error('Error while updating user servers');
                error(err);
                return res.json({
                  ok: false,
                  message: 'Error while updating user servers',
                });
              }
            } catch (err) {
              error('Error while updating user servers');
              error(err);
              return res.json({
                ok: false,
                message: err?.message || 'Error while updating user servers',
              });
            }
          }

          else {
            return res.json({
              ok: true,
              message: "Server already added"
            })
          }
        }
      } else {
        return res.json({
          ok: false,
          message: 'User not found',
        });
      }
    } catch (err) {
      error('Error while fetching user info');
      error(err);
      return res.json({
        ok: false,
        message: err?.message || 'Error while fetching user info',
      });
    }
  } catch (err) {
    error('Error in fetch');
    error(err);
    return res.json({
      ok: false,
      message: err?.message || 'Internal Server Error',
    });
  }
};
