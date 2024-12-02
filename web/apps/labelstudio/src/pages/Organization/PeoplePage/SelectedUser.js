import { format } from "date-fns";
import { NavLink } from "react-router-dom";
import { LsCross } from "../../../assets/icons";
import { Button, Userpic } from "../../../components";
import { Block, Elem } from "../../../utils/bem";
import "./SelectedUser.styl";
import { Space } from "apps/labelstudio/src/components/Space/Space";
import { useAPI } from "apps/labelstudio/src/providers/ApiProvider";
import { useEffect, useState } from "react";
import { isAllowed } from "RBAC";

const UserProjectsLinks = ({projects}) => {
  return (
    <Elem name="links-list">
      {projects.map((project) => (
        <Elem tag={NavLink} name="project-link" key={`project-${project.id}`} to={`/projects/${project.id}`} data-external>
          {project.title}
        </Elem>
      ))}
    </Elem>
  );
};

export const SelectedUser = ({ user, onClose, updateUserInList, isCurrentUserAdmin, isSelfSelected, loading, setLoading }) => {
  const api = useAPI();
  const [updatedUser, setUpdatedUser] = useState(user);

  useEffect(() => {
    setUpdatedUser(user);
  }, [user]);

  const isAdmin = isAllowed(user.email);

  const handleUpdateUserRole = () => {
    setLoading(true);
    try{
      api.callApi('updateUserRole', { params: { id: user.id }, body: { has_admin_access: !updatedUser.has_admin_access  } }).then((res) => {
        setUpdatedUser({ ...user,...res});
        updateUserInList({ ...user,...res});
      });
    } catch(err) {}
    finally{
      setTimeout(() => setLoading(false), 800);
    }
  };

  const fullName = [updatedUser.first_name, updatedUser.last_name].filter(n => !!n).join(" ").trim();

  return (
    <Block name="user-info">
      <Elem name="close" tag={Button} type="link" onClick={onClose}><LsCross/></Elem>

      <Elem name="header">
        <Userpic
          user={updatedUser}
          style={{width: 64, height: 64, fontSize: 28}}
        />

        {fullName && (
          <Elem name="full-name">{fullName}</Elem>
        )}

        <Elem tag="p" name="email">{updatedUser.email}</Elem>
      </Elem>

      {updatedUser.phone && (
        <Elem name="section">
          <a href={`tel:${updatedUser.phone}`}>{updatedUser.phone}</a>
        </Elem>
      )}

      {!!updatedUser.created_projects.length && (
        <Elem name="section">
          <Elem name="section-title">Created Projects</Elem>

          <UserProjectsLinks projects={updatedUser.created_projects}/>
        </Elem>
      )}

      {!!updatedUser.contributed_to_projects.length && (
        <Elem name="section">
          <Elem name="section-title">Contributed to</Elem>

          <UserProjectsLinks projects={updatedUser.contributed_to_projects}/>
        </Elem>
      )}

      <Elem tag="p" name="last-active">
        Last activity on: {format(new Date(updatedUser.last_activity), 'dd MMM yyyy, KK:mm a')}
      </Elem>
      
      <Elem name="section">
          {
            isAdmin ? <><Elem name="section-title">User Role &apos;{'Super Admin'}&apos;</Elem></> :
            isCurrentUserAdmin ? <><Elem name="section-title">User Role &apos;{updatedUser.has_admin_access ? 'Admin' : 'Normal User'}&apos;</Elem>
            <Space>
              <Button icon={""} primary onClick={handleUpdateUserRole} disabled={loading || isSelfSelected}>
                Update User Role to { !updatedUser.has_admin_access ? 'Admin' : 'Normal User' }
              </Button>
            </Space></> : <></>
          }
      </Elem>
    </Block>
  );
};
