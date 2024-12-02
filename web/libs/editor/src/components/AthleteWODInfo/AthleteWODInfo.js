import React from "react";
import defaultImg from './../../assets/img/default_profile_img.png'
import styles from "./AthleteWODInfo.module.scss"

function AthleteWODInfo({ athleteName, athleteImg, wod ,...props }) {
    return (
        <div className={styles.rootDiv}>
            <div>
                <h4>{athleteName}</h4>
            </div>
            <div className={styles.athleteImgContainer}>
                <img src={athleteImg ?? defaultImg} alt={athleteName ?? 'profile image'} />
            </div>
            <div>
                <h5>WOD:</h5>
                <p className={styles.wod}>
                    {wod}
                </p>
            </div>
        </div>
    );
};

export default AthleteWODInfo;