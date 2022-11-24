let menu =  document.querySelector( '.menu' );
let sidebar_left =  document.querySelector( '.sidebar-left' );
let sidebar_right =  document.querySelector( '.sidebar-right' );
let file_option =  document.querySelector( '.file-option' );
let is_toggled =  false ;
menu.addEventListener( 'click' ,  (e) => {
    if (is_toggled) {
        sidebar_left.style.display =  'none' ;
        is_toggled =  false ;
    }  else  {
        sidebar_left.style.display =  'flex' ;
        file_option.style.visibility =  'hidden' ;
        is_toggled =  true ;
    }
} );

let logo = document.querySelector(".logo");
logo.onclick = () => {
    window.open("https://github.com/jnsougata/filebox", "_blank");
}
