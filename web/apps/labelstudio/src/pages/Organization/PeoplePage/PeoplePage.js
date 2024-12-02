import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LsPlus } from "../../../assets/icons";
import { Button } from "../../../components";
import { Description } from "../../../components/Description/Description";
import { Input } from "../../../components/Form";
import { HeidiTips } from "../../../components/HeidiTips/HeidiTips";
import { Modal, modal } from "../../../components/Modal/Modal";
import { Space } from "../../../components/Space/Space";
import { useAPI } from "../../../providers/ApiProvider";
import { useConfig } from "../../../providers/ConfigProvider";
import { Block, Elem } from "../../../utils/bem";
import { FF_LSDV_E_297, isFF } from "../../../utils/feature-flags";
import { copyText } from "../../../utils/helpers";
import "./PeopleInvitation.styl";
import { PeopleList } from "./PeopleList";
import "./PeoplePage.styl";
import { SelectedUser } from "./SelectedUser";
import { isAllowed } from "RBAC";
// import { Modal } from "antd"

const InvitationModal = ({ link }) => {
  return (
    <Block name="invite">
      <Input
        value={link}
        style={{ width: '100%' }}
        readOnly
      />

      <Description style={{ width: '70%', marginTop: 16 }}>
        Invite people to join your Label Studio instance. People that you invite have full access to all of your projects. <a href="https://labelstud.io/guide/signup.html">Learn more</a>.
      </Description>
    </Block>
  );
};

const RolesModal = ({ props }) => {
  return (
    <Block name="invite">
      <Description style={{ width: '70%', marginTop: 16 }}>
        Select users appropriate roles and then save.
      </Description>
    </Block>
  );
};

export const PeoplePage = () => {
  const api = useAPI();
  const inviteModal = useRef();
  const rolesModal = useRef();
  const config = useConfig();
  const [selectedUser, setSelectedUser] = useState(null);

  const [usersList, setUsersList] = useState();

  const updateUserInList = useCallback((updatedUser) => {
    const idx = usersList?.findIndex(u => u.id === updatedUser?.id);
    if(idx > -1) {
      const temp = [...usersList];
      temp[idx] = updatedUser;
      setUsersList([...temp]);
    }
  }, []);

  const [updatedUser, setUpdatedUser] = useState(null);

  const [loading, setLoading] = useState(false);

  const [link, setLink] = useState();
  const [users, setUsers] = useState([]);
  const [auth, setAuth] = useState();
  const [canChangeRoles, setCanChangeRoles] = useState(false);


  const selectUser = useCallback((user) => {
    setSelectedUser(user);

    localStorage.setItem('selectedUser', user?.id);
  }, [setSelectedUser]);

  const setInviteLink = useCallback((link) => {
    const hostname = config.hostname || location.origin;

    setLink(`${hostname}${link}`);
  }, [config, setLink]);

  const updateLink = useCallback(() => {
    api.callApi('resetInviteLink').then(({ invite_url }) => {
      setInviteLink(invite_url);
    });
  }, [setInviteLink]);

  const inviteModalProps = useCallback((link) => ({
    title: "Invite people",
    style: { width: 640, height: 472 },
    body: () => (
      <InvitationModal link={link} />
    ),
    footer: () => {
      const [copied, setCopied] = useState(false);

      const copyLink = useCallback(() => {
        setCopied(true);
        copyText(link);
        setTimeout(() => setCopied(false), 1500);
      }, []);

      return (
        <Space spread>
          <Space>
            <Button style={{ width: 170 }} onClick={() => updateLink()}>
              Reset Link
            </Button>
          </Space>
          <Space>
            <Button primary style={{ width: 170 }} onClick={copyLink}>
              {copied ? "Copied!" : "Copy link"}
            </Button>
          </Space>
        </Space>
      );
    },
    bareFooter: true,
  }), []);

  const showInvitationModal = useCallback(() => {
    inviteModal.current = modal(inviteModalProps(link));
  }, [inviteModalProps, link]);

  const defaultSelected = useMemo(() => {
    return localStorage.getItem('selectedUser');
  }, []);



  useEffect(() => {
    api.callApi("inviteLink").then(({ invite_url }) => {
      setInviteLink(invite_url);
    });
    api.callApi("me").then((res) => {
      setAuth(res);
    });
  }, []);

  useEffect(() => {
    setCanChangeRoles(isAllowed(auth?.email) || auth?.has_admin_access)
  }, [auth]);

  useEffect(() => {
    inviteModal.current?.update(inviteModalProps(link));
  }, [link]);

  const rolesModalProps = useCallback((link) => ({
    title: "Update people roles",
    style: { width: 640, height: 472 },
    body: () => (
      <RolesModal link={link} />
    ),
    footer: () => {
      const [copied, setCopied] = useState(false);

      const copyLink = useCallback(() => {
        setCopied(true);
        copyText(link);
        setTimeout(() => setCopied(false), 1500);
      }, []);

      return (
        <Space spread>
          <Space>
            <Button style={{ width: 170 }} onClick={() => updateLink()}>
              Reset Link
            </Button>
          </Space>
          <Space>
            <Button primary style={{ width: 170 }} onClick={copyLink}>
              {copied ? "Copied!" : "Copy link"}
            </Button>
          </Space>
        </Space>
      );
    },
    bareFooter: true,
  }), []);

  const showRolesModal = useCallback(() => {
    rolesModal.current = modal(rolesModalProps(link));
  }, [rolesModalProps, link]);

  return (
    <Block name="people">
      <Elem name="controls">
        <Space spread>
          <Space></Space>

          <Space>
            <Button icon={<LsPlus />} primary onClick={showInvitationModal}>
              Add People
            </Button>
          </Space>
          {/* <Space>
            <Button icon={""} primary onClick={showRolesModal}>
              Update People Role
            </Button>
          </Space> */}
        </Space>
      </Elem>
      <Elem name="content">
        <PeopleList
          usersList={usersList}
          setUsersList={setUsersList}
          selectedUser={selectedUser}
          defaultSelected={defaultSelected}
          onSelect={(user) => selectUser(user)}
          loading={loading}
          // updatedUser={updatedUser}
        />

        {selectedUser ? (
          <SelectedUser
            user={selectedUser}
            onClose={() => {selectUser(null); setUpdatedUser(null)}}
            updateUserInList={updateUserInList}//{(usr) => setUpdatedUser(usr)}
            isCurrentUserAdmin={canChangeRoles}
            isSelfSelected={selectedUser.id === auth.id}
            loading={loading}
            setLoading={setLoading}
          />
        ) : isFF(FF_LSDV_E_297) && (
          <HeidiTips collection="organizationPage" />
        )}
      </Elem>
    </Block>
  );
};

PeoplePage.title = "People";
PeoplePage.path = "/";
