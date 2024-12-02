const allowedUsers = [
    'test@test.com',
    'test22@test.com'
];


const isAllowed = (userEmail, paramArray=[]) => {
    if (!userEmail) return false;
    const matchArray = paramArray.length ? [ ...paramArray ] : [ ...allowedUsers ];
    return matchArray.some(usr => usr === userEmail);
}

const fetchAdminsList = (cbLoading=null, cbSetData=null) => {
    let list = [];
    try {
        // fetch('https://mobile.highqfit.com/labelstudio_svc/list_admin_users')
        // .then(res => res.json())
        // .then(data => {
        //     //@ts-ignore
        //     list = [...data['admin']];
        //     if (cbSetData) cbSetData?.([...data['admin']]);
        // });
    }
    catch(err) {
        console.error('ERROR while fetching the admins list: ', err);
    }
    finally {
        if (cbLoading) cbLoading?.(false);
    }
    return list;
};

export { isAllowed, fetchAdminsList };